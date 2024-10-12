/**
 * @param {string[]} columns
 * @returns {string}
 */
function generateTableHead(columns) {
  return `
      <thead>
        <tr >
          ${columns.map((column) => `<th>${column}</th>`).join("")}
        </tr>
      </thead>
    `;
}

/**
 * @param {any[][]} rows
 * @param {{classes: string[]}} [options]
 * @returns {string}
 */
function generateTableBody(rows, { classes } = { classes: [] }) {
  return `
      <tbody class="${classes.join(" ")}">
        ${rows
          .map(
            (row) => `
            <tr>
              ${row
                .map(
                  (column) => `
                <td>${column}</td>
              `
                )
                .join("")}
            </tr>
          `
          )
          .join("")}
      <tbody>
    `;
}
/**
 * @param {{columnNames: string[], resultRows: any[]}} data
 * @returns {string}
 */
function table(data) {
  const htmlTableHead = generateTableHead(data.columnNames);
  const htmlTableBody = generateTableBody(data.resultRows, {
    classes: ["table-group-divider"],
  });
  const htmlTable = `
      <table class="table table-striped table-bordered"> 
        ${htmlTableHead}
        ${htmlTableBody}
      </table>
    `;
  return htmlTable;
}

/**
 * @param {{columnNames: string[], resultRows: any[][]}} data
 * @returns {void}
 */
function grid(data) {
  /**
   * @type {{id: string, name: string, field: string}[]}
   */
  const gridColumns = data.columnNames.map((column) => {
    return {
      id: column,
      name: column,
      field: column,
    };
  });
  /**
   * @type {{[key: string]: any}[]}
   */
  const gridData = data.resultRows.map((row) => {
    /**
     * @type {{[key: string]: any}}
     */
    const mappedRowToObject = {};
    row.forEach((column, i) => {
      mappedRowToObject[data.columnNames[i]] = String(column);
    });
    return mappedRowToObject;
  });
  const options = {
    enableCellNavigation: true,
    enableColumnReorder: true,
    enableAutoResize: true,
  };
  new Slick.Grid("#grid", gridData, gridColumns, options);
}
