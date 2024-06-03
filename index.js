#!/usr/bin/env node

import axios from "axios";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const API_KEY = config.api_key;
const API_URL = "https://api.fastforex.io";

const conversionsFile = path.join(__dirname, "conversions.json");

const loadConversions = () => {
  if (fs.existsSync(conversionsFile)) {
    return JSON.parse(fs.readFileSync(conversionsFile));
  }
  return [];
};

const saveConversion = (conversion) => {
  const conversions = loadConversions();
  conversions.push(conversion);
  fs.writeFileSync(conversionsFile, JSON.stringify(conversions, null, 2));
};

const getExchangeRates = async (date, base) => {
  try {
    const response = await axios.get(
      `${API_URL}/historical?date=${date}&base=${base}&api_key=${API_KEY}`
    );
    if (response.data.results) {
      return response.data.results;
    } else {
      console.error("Unexpected API response format:", response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error fetching exchange rates:", error.message);
    process.exit(1);
  }
};

const validateAmount = (input) => {
  const amount = parseFloat(input);
  return amount > 0 && /^\d+(\.\d{1,2})?$/.test(input)
    ? true
    : "Please enter a valid amount (e.g., 10.23)";
};

const validateCurrency = (input) => {
  return /^[A-Z]{3}$/i.test(input)
    ? true
    : "Please enter a valid ISO 4217 currency code (e.g., USD, EUR)";
};

const main = async (date) => {
  const cachedRates = {};

  while (true) {
    const { amount, baseCurrency, targetCurrency } = await inquirer.prompt([
      {
        type: "input",
        name: "amount",
        message: "Amount:",
        validate: validateAmount,
      },
      {
        type: "input",
        name: "baseCurrency",
        message: "Base currency:",
        validate: validateCurrency,
      },
      {
        type: "input",
        name: "targetCurrency",
        message: "Target currency:",
        validate: validateCurrency,
      },
    ]);

    if (
      amount.toLowerCase() === "end" ||
      baseCurrency.toLowerCase() === "end" ||
      targetCurrency.toLowerCase() === "end"
    ) {
      console.log("Terminating the application.");
      break;
    }

    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();
    const amountValue = parseFloat(amount).toFixed(2);

    if (!cachedRates[base]) {
      console.log(`Fetching exchange rates for ${base} on ${date}...`);
      cachedRates[base] = await getExchangeRates(date, base);
    }

    if (!cachedRates[base]) {
      console.log(
        `Could not fetch exchange rates for ${base}. Please try again.`
      );
      continue;
    }

    const rate = cachedRates[base][target];
    if (!rate) {
      console.log(`Exchange rate for ${base} to ${target} not found.`);
      continue;
    }

    const convertedAmount = (amountValue * rate).toFixed(2);
    console.log(`${amountValue} ${base} is ${convertedAmount} ${target}`);

    const conversion = {
      date,
      amount: amountValue,
      base_currency: base,
      target_currency: target,
      converted_amount: convertedAmount,
    };

    saveConversion(conversion);
  }
};

const [, , dateArg] = process.argv;

if (!dateArg) {
  console.error("Please provide a date in the format YYYY-MM-DD");
  process.exit(1);
}

main(dateArg);
