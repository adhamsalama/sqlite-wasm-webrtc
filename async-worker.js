/**
 * @param {Worker} worker
 * @param {any} message
 * @returns {Promise<any>}
 */
function sendMessageToWorker(worker, message) {
  return new Promise((resolve, _reject) => {
    const messageId = Date.now() + Math.random(); // Generate a unique ID
    /**
     * @param {MessageEvent<any>} event
     */
    const handleMessage = (event) => {
      if (event.data.messageId === messageId) {
        // Check if the response matches
        worker.removeEventListener("message", handleMessage); // Cleanup
        resolve(event.data); // Resolve the promise with the response
      }
    };

    worker.addEventListener("message", handleMessage);

    worker.postMessage({ messageId, ...message }); // Send the message with the ID
  });
}

/**
 * @param {string} query
 */
async function sql(query) {
  /**
   * @type {{success: true, resultRows: any[], columnNames: string[]} | {success: false, error: string}}
   */
  const result = await sendMessageToWorker(window.sqlite3Worker, {
    type: "syncExec",
    sql: query,
  });
  if (!result.success) {
    alert(`${result.error} in query ${query}`);
    throw new Error(result.error);
  }
  return result;
}
