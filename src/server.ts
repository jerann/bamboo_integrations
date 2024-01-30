import * as dotenv from 'dotenv';
import express, { Request, Response } from 'express';
dotenv.config();
import { generateEmployees } from './api';
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

const app = express();
const port = 3000;

app.get('/', (req: Request, res: Response) => {
  res.send('Your employee data will be located in ./finalData/employees.json');
});

app.listen(port, () => {
  console.log(`StackOne Integrations app listening on port ${port}\nAPI Key loaded from .env file\n`);
  
  console.log(`Fetching and building Employee data...`);
  generateEmployees().then(employees => {
    const employeesJson = JSON.stringify(employees, null, 2);
    const filePath = './finalData/employees.json';
    fsPromises.writeFile(filePath, employeesJson).then(() => {
      console.log(`Employee JSON file created at ----> ${filePath} <----\n`);
      console.log(`That's all! Goodbye for now, and take care :)\nJeran Norman\njerann@umich.edu\n`);
      process.exit();
    }).catch((error) => {
      console.error(`Error writing JSON file: ${error}`);
    });
  });
});
