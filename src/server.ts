import * as dotenv from 'dotenv';
dotenv.config();
import { generateEmployees, buildHierarchy } from './api';
import { promises as fsPromises } from 'fs';

//Validate .env file; terminate process and show instructions if not detected
if (!process.env.BAMBOO_API_KEY || !process.env.BAMBOO_COMPANY_DOMAIN) {
  console.log(`
It is mandatory to create a "./.env" file containing:
BAMBOO_API_KEY={Your API Key}
BAMBOO_COMPANY_DOMAIN={Your Company Domain}
  `);

  if (!process.env.BAMBOO_API_KEY) console.error('BAMBOO_API_KEY is missing!');
  if (!process.env.BAMBOO_COMPANY_DOMAIN) console.error('BAMBOO_COMPANY_DOMAIN is missing!');
  process.exit();
}

const main = async () => {
  console.log(`API Key loaded from .env file\n`);

  console.log(`Fetching and building Employee data...`);
  try {
    const employees = await generateEmployees();
    const filePath = './finalData/employees.json';

    try {
      await writeObjectToFile(employees, filePath);
      console.log(`Employee JSON file created at ----> ${filePath} <----\n`);
    } catch (error) {
      console.error(`Error writing JSON file: ${error}`);
    };

    console.log(`Building organization hierarchy...`);

    try {
      const hierarchy = buildHierarchy(employees);
      const filePath = './finalData/hierarchy.json';

      try {
        await writeObjectToFile(hierarchy, filePath);
        console.log(`Hierarchy JSON file created at ----> ${filePath} <----\n`);
      } catch (error) {
        console.error(`Error writing JSON file: ${error}`);
      };

      console.log(`That's all! Goodbye for now, and take care :)\nJeran Norman\njerann@umich.edu\n`);
      process.exit();
    } catch (error) {
      console.error(`Failed to build Hierarchy data: ${error}`);
    }
  } catch (error) {
    console.error(`Failed to build Employee data: ${error}`);
  }
};

const writeObjectToFile = async (object: object, path: string) => {
  const json = JSON.stringify(object, null, 2);
  await fsPromises.writeFile(path, json);
};

main();
