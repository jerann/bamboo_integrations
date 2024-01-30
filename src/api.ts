import axios, { AxiosInstance } from 'axios';
import Employee from './types/employee';
import CustomReport from './types/customReport';

//Set default configuration for Axios requests
const api: AxiosInstance = axios.create({
  baseURL: `https://api.bamboohr.com/api/gateway.php/${process.env.BAMBOO_COMPANY_DOMAIN}/`,
  auth: {
    username: process.env.BAMBOO_API_KEY ?? '',
    password: 'x'
  },
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

//Returns a list of Employees from a combination of Custom Report and Directory data
async function generateEmployees(): Promise<Employee[]> {
  return Promise.all([
    generateCustomReport(),
    employeeDirectory()
  ]).then(([customReport, employeeDirectoryData]) => {

    //Create ID map of custom report
    const customReportIDMap: Map<string, any> = new Map();
    customReport.employees.forEach(e => {
      if (e.id) customReportIDMap.set(e.id, e);
    });

    //Create ID map of employee directory
    const directoryIDMap: Map<string, any> = new Map();
    employeeDirectoryData.forEach(e => {
      if (e.id) directoryIDMap.set(e.id, e);
    });

    //Create Name and ID maps of Employees for Manager lookup
    const employeeByName: Map<string, Employee> = new Map();
    const supervisorNameByID: Map<string, string> = new Map();

    //Create current time constants
    const now = new Date().getTime();
    const currentYear = new Date().getFullYear();

    //Create initial Employee objects by merging directory data with custom report
    let employees: Employee[] = [];
    customReportIDMap.forEach((employeeObject, id) => {
      const directoryObject = directoryIDMap.get(id);
      const combined = Object.assign(directoryObject ?? {}, employeeObject);

      //Create employee-specific dates
      const start_date = combined.hireDate ? new Date(combined.hireDate) : undefined;
      const anniversary = start_date ? new Date(start_date) : undefined;
      if (anniversary) {
        anniversary.setFullYear(currentYear);
        if (anniversary.getTime() < now) anniversary.setFullYear(currentYear + 1);
      }
      const tenure = start_date ? Math.floor((now - start_date.getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : undefined;

      //Create default employee name
      const name = `${combined.firstName} ${combined.middleName != 'null' ? '' : `${combined.middleName} `}${combined.lastName}`;

      //Create Employee object
      const employee : Employee = {
        id: id,
        first_name: combined.firstName,
        last_name: combined.lastName,
        name: name,
        display_name: combined.displayName ?? `${combined.firstName} ${combined.lastName}}`,
        date_of_birth: combined.dateOfBirth ? new Date(combined.dateOfBirth) : undefined,
        avatar_url: combined.photoUrl,
        personal_phone_number: combined.mobilePhone ?? combined.homePhone,
        work_email: combined.workEmail,
        job_title: combined.jobTitle,
        department: combined.department,
        manager_id: undefined, // Will be set shortly!
        start_date: start_date,
        tenure: tenure,
        work_anniversary: anniversary,
        gpa: combined.GPA,
        location: combined.location
      };
      employees.push(employee);

      //Add employee to lookup maps
      employeeByName.set(employee.display_name, employee);
      if (combined.supervisor) supervisorNameByID.set(employee.id, combined.supervisor);
    });

    //Lookup and assign manager data
    employees.forEach(e => {
      const supervisorName = supervisorNameByID.get(e.id);
      if (!supervisorName) return;

      const supervisorEmployee = employeeByName.get(supervisorName);
      if (!supervisorEmployee) return;
    
      e.manager_id = supervisorEmployee.id;
      e.manager_name = supervisorEmployee.name;
      e.manager_title = supervisorEmployee.job_title;
    });

    return employees;
  }).catch((error) => {
    throw Error(`Failed to generate Employees: ${error}`);
  });
}

// Returns a CustomReport using subsequent "fields" and "custom report" APIs
async function generateCustomReport(): Promise<CustomReport> {
  return fields().then(returnedFields => {
    const filteredFields = filterFields(returnedFields);
    return customReport(filteredFields).then(report => {
      return report;
    });
  });
}

// Returns all employees
// https://documentation.bamboohr.com/reference/get-employees-directory-1
// WARNING: This endpoint can be disabled by companies 
async function employeeDirectory(): Promise<any[]> {
  return api.get('v1/employees/directory')
    .then((response) => response.data.employees)
    .catch((error) => {
      logAPIError(error);
      throw Error('Failed to fetch employee directory');
    });
}

// Returns all available fields
// The "alias" property is prioritized over "name"
// https://documentation.bamboohr.com/reference/metadata-get-a-list-of-fields
async function fields(): Promise<string[]> {
  return api.get('v1/meta/fields')
    .then((response) => {
      let responseFields = response.data.map((e: any) => e.alias ?? e.name);
      return responseFields;
    })
    .catch((error) => {
      logAPIError(error);
      throw Error('Failed to fetch available fields');
    });
}

//Returns the intersection of "fields" and a pre-defined set of relevant fields
function filterFields(fields: string[]): string[] {
  const relevantFields = new Set<string>([
    'id',
    'firstName',
    'middleName',
    'lastName',
    'preferredName',
    'nickname',
    'dateOfBirth',
    'mobilePhone',
    'homePhone',
    'workEmail',
    'jobTitle',
    'department',
    'Reporting To',
    'hireDate',
    'GPA',
    'location'
  ]);

  return fields.filter(e => relevantFields.has(e));
}

// Generates an employee report
// Requires list of fields to be included
// https://documentation.bamboohr.com/reference/request-custom-report-1
async function customReport(fields: string[]): Promise<CustomReport> {
  const body = {
    fields: fields
  };

  return api.post('v1/reports/custom', body)
    .then((response) => {
      const report : CustomReport = {
        fields: response.data.fields,
        employees: response.data.employees
      };
      return report;
    })
    .catch((error) => {
      logAPIError(error);
      throw Error('Failed to create Custom Report from API response');
    });
}

//Displays information for errors resulting in API request functions
function logAPIError(error: any) {
  //Handle parsing error
  if (!error.response || (error.response.status >= 200 && error.response.status <= 299)) {
    console.error(`Error parsing API Response from ${error.request.host}${error.request.path}\nError: ${error}`);
    return;
  }

  //Handle response error
  let errorType = (error.response.status >= 400 && error.response.status <= 499) ? 'Client' : 'Server';
  console.error(`${errorType} Error in API Request: Code ${error.response.status}`);
  console.error(`To ${error.request.host}${error.request.path}`);
  const errorHeader = error.response.headers['x-bamboohr-error-message'];
  if (errorHeader) console.error(`X-BambooHR-Error-Message Header: ${error.response.headers['x-bamboohr-error-message']}`);
}

export { generateEmployees };