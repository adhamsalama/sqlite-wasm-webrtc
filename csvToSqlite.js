/**
 * @param {string} csvString
 * @param {string} tableName
 * @returns {{tableName: string, createTable: string, insert: string}}
 */
function createTableFromCSV(csvString, tableName) {
  const lines = CSV.parse(csvString);
  const headers = lines[0].map((l) => l.replaceAll(" ", "_"));
  const firstNonHeaderLine = lines[1];
  /**
   * @type {string[]}
   */
  const dataTypes = [];
  firstNonHeaderLine.forEach((column) => {
    if (isNumeric(column)) {
      dataTypes.push("REAL");
    } else {
      dataTypes.push("TEXT");
    }
  });
  const sanitizedTableName = sanitizeTableName(tableName);
  // Create a table with the column names from CSV
  const createTableSQL = `CREATE TABLE ${sanitizedTableName} (${headers
    .map((header, i) => `${header} ${dataTypes[i]}`)
    .join(", ")})`;

  // Prepare a single INSERT statement
  const insertSQL = `INSERT INTO ${sanitizedTableName} (${headers.join(
    ", "
  )}) VALUES `;

  const values = [];
  // Prepare values for the INSERT statement
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    values.push(
      `(${row.map((column) => `'${column.replace("'", "''")}'`).join(",")})`
    );
  }
  const fullInsertValues = values.join(",");

  // Combine the INSERT statement with the formatted values
  const fullInsertSQL = insertSQL + fullInsertValues;
  // Return the create table and insert queries
  return {
    tableName: sanitizedTableName,
    createTable: createTableSQL,
    insert: fullInsertSQL,
  };
}
/**
 * @param {string} fileName
 * @returns {string}
 */
function sanitizeTableName(fileName) {
  // Remove the file extension
  const baseName = fileName.replace(/\.[^/.]+$/, "");

  // Remove invalid characters and replace with underscores
  const sanitized = baseName.replace(/[^a-zA-Z0-9_]/g, "_");

  // Limit to 64 characters (or any reasonable length)
  const limited = sanitized.substring(0, 64);

  // Check for reserved keywords and handle accordingly
  const reservedKeywords = ["table", "select", "insert", "delete", "update"]; // Add more as needed
  if (reservedKeywords.includes(limited.toLowerCase())) {
    return `tbl_${limited}`; // Prefix with 'tbl_' to avoid keyword conflict
  }

  return limited;
}

const CSV = {
  /**
   * @param {string} csv
   * @param {*} [reviver]
   * @returns {string[][]}
   */
  parse: function (csv, reviver) {
    reviver =
      reviver ||
      function (r, c, v) {
        return v;
      };
    let chars = csv.split(""),
      c = 0,
      cc = chars.length,
      start,
      end,
      table = [],
      row;
    while (c < cc) {
      table.push((row = []));
      while (c < cc && "\r" !== chars[c] && "\n" !== chars[c]) {
        start = end = c;
        if ('"' === chars[c]) {
          start = end = ++c;
          while (c < cc) {
            if ('"' === chars[c]) {
              if ('"' !== chars[c + 1]) {
                break;
              } else {
                chars[++c] = ""; // unescape ""
              }
            }
            end = ++c;
          }
          if ('"' === chars[c]) {
            ++c;
          }
          while (
            c < cc &&
            "\r" !== chars[c] &&
            "\n" !== chars[c] &&
            "," !== chars[c]
          ) {
            ++c;
          }
        } else {
          while (
            c < cc &&
            "\r" !== chars[c] &&
            "\n" !== chars[c] &&
            "," !== chars[c]
          ) {
            end = ++c;
          }
        }
        row.push(
          reviver(
            table.length - 1,
            row.length,
            chars.slice(start, end).join("")
          )
        );
        if ("," === chars[c]) {
          ++c;
        }
      }
      if ("\r" === chars[c]) {
        ++c;
      }
      if ("\n" === chars[c]) {
        ++c;
      }
    }
    return table;
  },

  stringify: function (table, replacer) {
    replacer =
      replacer ||
      function (r, c, v) {
        return v;
      };
    let csv = "",
      c,
      cc,
      r,
      rr = table.length,
      cell;
    for (r = 0; r < rr; ++r) {
      if (r) {
        csv += "\r\n";
      }
      for (c = 0, cc = table[r].length; c < cc; ++c) {
        if (c) {
          csv += ",";
        }
        cell = replacer(r, c, table[r][c]);
        if (/[,\r\n"]/.test(cell)) {
          cell = '"' + cell.replace(/"/g, '""') + '"';
        }
        csv += cell || 0 === cell ? cell : "";
      }
    }
    return csv;
  },
};

/**
 * @param {string} str
 * @returns {boolean}
 */
function isNumeric(str) {
  if (typeof str != "string") return false; // we only process strings!
  return (
    !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ); // ...and ensure strings of whitespace fail
}
