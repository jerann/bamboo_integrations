import CustomReportEmployee from './customReportEmployee';

interface CustomReport {
    fields: string[],
    employees: CustomReportEmployee[]
}

export default CustomReport;