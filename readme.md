# StackOne Take Home Assignment - Integration

This Node.js and TypeScript application fetches employee data from the BambooHR API and generates two JSON files; one of employee data, one representing organization hierarchy based on manager assignments.

## Prerequisites

You will need a BambooHR account for a Company Domain and [API Key](https://documentation.bamboohr.com/docs/getting-started).

Before running, make sure you have installed:

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)

## Getting Started

1. Clone the repository

2. Navigate to the project directory in your terminal:

    ```bash
    cd bamboo_integrations
    ```

3. Create a `.env` file in the root directory with the following format:

    ```env
    BAMBOO_API_KEY=your-api-key
    BAMBOO_COMPANY_DOMAIN=your-company-domain
    ```

    Replace `your-api-key` and `your-company-domain` with your BambooHR API key and company domain. 

4. Install dependencies, build the TypeScript, and run the server:

    ```bash
    npm install
    npm run build
    npm start
    ```

The application will then fetch and build employee data using multiple APIs, generate the "employees.json" and "hierarchy.json" files, and terminate. 

The resulting files will be located at `./finalData/employees.json` and `./finalData/hierarchy.json`.

Please contact jerann@umich.edu if you have any issues building or running.

## Where to Look

All of the "interesting" code is located in `./src/api.ts`.

This uses 3 BambooHR API endpoints to retrieve data:
- [Get Employee Directory](https://documentation.bamboohr.com/reference/get-employees-directory-1)
  - This feature must be enabled in your BambooHR settings
- [Get a list of fields](https://documentation.bamboohr.com/reference/metadata-get-a-list-of-fields)
- [Request a custom report](https://documentation.bamboohr.com/reference/request-custom-report-1)

A list of available employee fields are requested, and a pre-defined set of filters are applied to request a custom report employee report.

The employee directory is also requested, and combined with the employee report to create the final employee data.

## Dependencies

- [Axios](https://www.npmjs.com/package/axios)
- [dotenv](https://www.npmjs.com/package/dotenv)