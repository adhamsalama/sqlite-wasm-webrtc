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
 * @param {QueryResult2["resultRows"]} rows
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
 * @returns {Promise<string>}
 */
async function table(data) {
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
 * @typedef {{
 *  columnNames: string[],
 *  resultRows: any[][]
 * }} QueryResult2
 */
