const w = new Worker("sqlite3-worker1.js");
window.sqlite3Worker = w;
/**
 *
 * @param {MessageEvent<any>} event
 */
w.onmessage = function (event) {
  event = event.data;
  switch (event.type) {
    case "sqlite3-api":
      if ("worker1-ready" === event.result) {
        // The worker is now ready to accept messages
        const form =
          /** @type {HTMLFormElement} */ document.getElementById("query-form");
        /**
         *
         * @param {string} query
         */
        async function handleSqlInput(query) {
          const res = await sql(query);
          if (res.resultRows) {
            const spreadsheetDiv = document.getElementById("spreadsheet-div");
            // @ts-ignore
            /*const tableHtml = await table(res);
            spreadsheetDiv.innerHTML = tableHtml;*/
            grid(res);
          }
        }
        document.getElementById("download").onclick = async (e) => {
          /**
           * @param {File} file
           */
          function downloadFile(file) {
            // Create a Blob if you only have a File object
            const blob = new Blob([file], { type: file.type });
            // Create a link element
            const link = document.createElement("a");
            // Create a URL for the Blob and set it as the href
            const url = URL.createObjectURL(blob);
            link.href = url;
            // Set the download attribute with a filename
            link.download = file.name || "download";
            // Append the link to the body (required for Firefox)
            document.body.appendChild(link);
            // Programmatically click the link to trigger the download
            link.click();
            // Clean up: remove the link and revoke the object URL
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
          const root = await navigator.storage.getDirectory();
          const fileHandle = await root.getFileHandle("db.sqlite3");
          const file = await fileHandle.getFile();
          downloadFile(file);
        };
        /**
         * @param {SubmitEvent} e
         */
        form.onsubmit = async (e) => {
          e.preventDefault();
          const query = /** @type {HTMLTextAreaElement} */ (
            document.getElementById("query")
          );
          if (query?.value) {
            console.time("userQuery");
            await handleSqlInput(query.value);
            sendFragmentedMessageToPeers(query.value);
            console.timeEnd("userQuery");
          } else {
            /**
             * @type {HTMLInputElement}
             */
            const fileInput = document.getElementById("file_input");
            /**
             * @type {File}
             */
            const file = fileInput.files[0];
            console.log({ fileType: file.type });
            const SUPPORTED_FILE_TYPES = {
              CSV: "text/csv",
              SQLITE: "application/vnd.sqlite3",
            };
            if (
              Object.values(SUPPORTED_FILE_TYPES).includes(file.type) == false
            ) {
              alert(`Unsupported file type: ${file.type}`);
              return;
            }
            const reader = new FileReader();
            switch (file.type) {
              case SUPPORTED_FILE_TYPES.CSV: {
                reader.readAsText(file);
                reader.onload = async (e) => {
                  const content = e.target.result; // Get file content
                  console.time("importCsv");
                  const { tableName, createTable, insert } = createTableFromCSV(
                    content,
                    file.name
                  );
                  await handleSqlInput(createTable);
                  sendFragmentedMessageToPeers(createTable);
                  await handleSqlInput(insert);
                  console.timeEnd("importCsv");
                  generateNotification("Import finished successfully.");
                  sendFragmentedMessageToPeers(insert);
                };
                break;
              }
              case SUPPORTED_FILE_TYPES.SQLITE: {
                reader.readAsArrayBuffer(file);
                reader.onload = async (e) => {
                  const root = await navigator.storage.getDirectory();
                  const fileHandle = await root.removeEntry("db.sqlite3");
                  const newFile = await root.getFileHandle("db.sqlite3", {
                    create: true,
                  });
                  const writableStream = await newFile.createWritable();
                  const data = await file.arrayBuffer();
                  await writableStream.write(data);
                  await writableStream.close();
                  generateNotification("Import finished successfully.");
                  sendFragmentedMessageToPeers(data);
                };
                break;
              }
              default: {
                console.error(`Unsupported file type: ${file.type}`);
                alert(`Unsupported file type: ${file.type}`);
              }
            }
            fileInput.value = "";
          }
        };
      }
    default: {
      //  console.log({ event });
    }
  }
};
