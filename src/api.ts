import axios, { AxiosInstance, AxiosError } from 'axios';
import Employee from './types/employee';
import CustomReport from './types/customReport';
import CustomReportEmployee from './types/customReportEmployee';
import DirectoryEmployee from './types/directoryEmployee';
import Field from './types/field';
import HierarchyNode from './types/hierarchyNode';

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

//Returns the top level HierarchyNodes, each representing a manager with the recursive manager/employee tree structure
function buildHierarchy(employees: Employee[]): HierarchyNode[] {
  const employeeIDsAdded: Set<string> = new Set([]);

  //Recursively navigates through array of employees, assigning node children based on Employee id and manager_id
  function traverseNodes(filteredEmployees: Employee[], managerId?: string): HierarchyNode[] {
    const nodes: HierarchyNode[] = [];
    const nextFilteredEmployees = filteredEmployees.filter(e => !employeeIDsAdded.has(e.id));

    filteredEmployees.forEach(e => {
      if (e.manager_id === managerId) {
        const node: HierarchyNode = { id: e.id };
        const reportingEmployees = traverseNodes(nextFilteredEmployees, e.id);
        if (reportingEmployees.length > 0) node.employees = reportingEmployees;
        nodes.push(node);
        employeeIDsAdded.add(e.id);
      }
    });
    return nodes;
  }

  const nodes = traverseNodes(employees);
  return nodes;
}

//Returns a list of Employees from a combination of Custom Report and Directory data
async function generateEmployees(): Promise<Employee[]> {

  const customReport = await generateCustomReport();
  const employeeDirectoryData = await employeeDirectory();

  //Create ID maps of custom report and employee directory
  const customReportEmployeesByID: Map<string, CustomReportEmployee> = new Map(customReport.employees.map(e => [e.id, e]));
  const directoryEmployeesByID: Map<string, DirectoryEmployee> = new Map(employeeDirectoryData.map(e => [e.id, e]));

  //Create Name and ID maps of Employees for Manager lookup
  const employeeByName: Map<string, Employee> = new Map();
  const supervisorNameByID: Map<string, string> = new Map();

  //Create current time constants
  const now = new Date().getTime();
  const currentYear = new Date().getFullYear();
  const millisecondsInYear = 1000 * 60 * 60 * 24 * 365.25;

  //Create initial Employee objects by merging directory data with custom report
  let employees: Employee[] = [];
  customReportEmployeesByID.forEach((employeeObject, id) => {
    const directoryObject = directoryEmployeesByID.get(id);
    const combined = { ...directoryObject ?? {}, ...employeeObject };

    //Create employee-specific dates
    const start_date = combined.hireDate ? new Date(combined.hireDate) : undefined;
    const anniversary = start_date ? new Date(start_date) : undefined;
    if (anniversary) {
      anniversary.setFullYear(currentYear);
      if (anniversary.getTime() < now) anniversary.setFullYear(currentYear + 1);
    }
    const tenure = start_date ? Math.floor((now - start_date.getTime()) / millisecondsInYear) : undefined;

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

  // Lookup and assign manager data in a new array
  const employeesWithManagerData = employees
    .map(e => {
      const supervisorName= supervisorNameByID.get(e.id);
      const supervisorEmployee = supervisorName && employeeByName.get(supervisorName);

      const finalEmployee = supervisorEmployee ? {
        ...e,
        manager_id: supervisorEmployee.id,
        manager_name: supervisorEmployee.name,
        manager_title: supervisorEmployee.job_title
      } : e;
      return finalEmployee;
    });
  return employeesWithManagerData;
}

// Returns a CustomReport using subsequent "fields" and "custom report" APIs
async function generateCustomReport(): Promise<CustomReport> {
  const returnedFields = await fields();
  const filteredFields = filterFields(returnedFields);
  const report = await customReport(filteredFields);
  return report;
}

// Returns all employees
// https://documentation.bamboohr.com/reference/get-employees-directory-1
// WARNING: This endpoint can be disabled by companies 
async function employeeDirectory(): Promise<DirectoryEmployee[]> {
  try {
    const response = await api.get('v1/employees/directory');
    return response.data.employees;
  } catch (error) {
    logAPIError(error);
    throw Error('Failed to fetch employee directory');
  }
}

// Returns all available fields
// The "alias" property is prioritized over "name"
// https://documentation.bamboohr.com/reference/metadata-get-a-list-of-fields
async function fields(): Promise<string[]> {
  try {
    const response = await api.get('v1/meta/fields');
    const responseFields = response.data.map((e: Field) => e.alias ?? e.name);
    return responseFields;
  } catch (error) {
    logAPIError(error);
    throw Error('Failed to fetch available fields');
  }
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
  try {
    const response = await api.post('v1/reports/custom', { fields });
    const report : CustomReport = {
      fields: response.data.fields,
      employees: response.data.employees
    };
    return report;
  } catch (error) {
    logAPIError(error);
    throw Error('Failed to create Custom Report from API response');
  }
}

//Displays information for errors resulting in API request functions
function logAPIError(error: AxiosError | unknown) {
  if (error instanceof AxiosError) {
    //Handle response error
    const errorType = (error.response?.status && error.response?.status >= 400 && error.response.status <= 499) ? 'Client' : 'Server';
    console.error(`${errorType} Error in API Request: Code ${error.response?.status}`);
    console.error(`To ${error.request.host}${error.request.path}`);
    const errorHeader = error.response?.headers['x-bamboohr-error-message'];
    if (errorHeader) console.error(`X-BambooHR-Error-Message Header: ${error.response?.headers['x-bamboohr-error-message']}`);
    return;
  }
  
  console.error(`Error parsing API Response. \nError: ${error}`);
}

export { generateEmployees, buildHierarchy };