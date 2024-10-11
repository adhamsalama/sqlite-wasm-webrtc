"use strict";
const fragmentedMessages = {};
let peers = [];
let userIds = new Set();
const displayMediaOptions = undefined;
let id = Math.random().toString(16).slice(2);
document.querySelector("#id").innerText = id;
let room = "";
const constraints = {
    video: false,
    audio: false,
};
const sdpConstraints = {
    offerToReceiveAudio: false,
    offerToReceiveVideo: false,
};
const roomName = document.getElementById("room");
const joinButton = document.getElementById("joinButton");
const hangupButton = document.getElementById("hangupButton");
const messages = document.getElementById("messages");
const newMessage = document.getElementById("newMessage");
const sendMessageButton = document.getElementById("sendMessage");
let localScreenCaptureEnabled = false;
function createPeerConnection(userId) {
    try {
        const localPeerConnection = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        const peer = { userId, pc: localPeerConnection, streams: new Set() };
        localPeerConnection.onicecandidate = (event) => {
            console.log("icecandidate event: ", event);
            if (event.candidate) {
                sendMessage({
                    type: "candidate",
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate,
                }, peer.userId);
            }
            else {
                console.log("End of candidates.");
            }
        };
        localPeerConnection.ontrack = (event) => {
            for (const stream of event.streams) {
                peer.streams.add(stream);
            }
        };
        console.log("Created RTCPeerConnnection");
        return peer;
    }
    catch (e) {
        console.log("Failed to create PeerConnection, exception: " + e.message);
        alert("Cannot create RTCPeerConnection object.");
        return;
    }
}
function setUpLocalPeer(userId) {
    console.log(">>>>>>> setting up local peer");
    console.log(">>>>>> creating peer connection");
    const peer = createPeerConnection(userId);
    if (!peer) {
        alert(`Failed to create PeerConnection in setUpLocalPeer`);
        return;
    }
    return peer;
}
/*navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
  console.log({ stream });
});
*/
async function startCapture(displayMediaOptions) {
    let captureStream = null;
    try {
        captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    }
    catch (err) {
        console.error(`Error: ${err}`);
    }
    return captureStream;
}
// @ts-ignore
const socket = io.connect();
joinButton.onclick = async () => {
    room = prompt("Enter room name:") ?? "";
    if (!room) {
        alert("Please enter a room name");
        return;
    }
    roomName.innerText = room;
    socket.emit("joinRoom", room);
    sendMessage("peerIsReady");
};
hangupButton.onclick = () => {
    hangup();
};
function sendFragmentedMessageToPeers(data) {
    // Calculate the byte length
    const DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES = 16000; // 16 KB
    const MESSAGE_TYPE = typeof data == "string" ? "TEXT" : "BINARY";
    const encodedMessage = typeof data == "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);
    console.log({ messageSize: encodedMessage.length });
    if (encodedMessage.length >= DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES) {
        console.log("message exceeds max size, fragmenting...");
        const numOfPackets = Math.ceil(encodedMessage.length / DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES);
        console.log({ numOfPackets });
        const messageBuffer = [];
        let packetBuffer = [];
        for (let i = 0; i < encodedMessage.length; i++) {
            packetBuffer.push(encodedMessage[i]);
            if (packetBuffer.length == DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES ||
                i == encodedMessage.length - 1) {
                messageBuffer.push([...packetBuffer]);
                packetBuffer = [];
            }
        }
        const messageId = new Date().getMilliseconds().toString();
        console.log({ messageBufferSize: messageBuffer.length });
        peers.forEach((peer) => {
            messageBuffer.forEach((chunk, i) => {
                const message = {
                    userId: id,
                    data: {
                        type: MESSAGE_TYPE,
                        chunk,
                        messageId,
                        index: i,
                        length: messageBuffer.length,
                        end: i < messageBuffer.length - 1 ? false : true,
                    },
                };
                peer.dc?.send(JSON.stringify(message));
            });
        });
        return;
    }
    peers.forEach((peer) => peer.dc?.send(JSON.stringify({ userId: id, data: { sql: data } })));
}
sendMessageButton.onclick = () => {
    const message = newMessage.value;
    peers.forEach((peer) => peer.dc?.send(JSON.stringify({ userId: id, data: message })));
    newMessage.value = "";
    displayNewMessage({ userId: id, data: message }, "right");
};
socket.on("joined", function (room) {
    console.log("joined: " + room);
    joinButton.disabled = true;
});
function displayNewMessage(message, alignment = "left") {
    const newMessageElement = document.createElement("li");
    newMessageElement.style.textAlign = alignment;
    newMessageElement.innerHTML = `${message.userId} ${message.userId == id ? "(Me)" : ""}: ${message.data}`;
    messages.appendChild(newMessageElement);
    const hr = document.createElement("hr");
    messages.appendChild(hr);
}
function addPeer(peer) {
    const existingPeerIndex = peers.findIndex((p) => p.userId == peer.userId);
    if (existingPeerIndex > -1) {
        peers[existingPeerIndex].pc.close();
        console.log(`^^^Replacing peer`, peers[existingPeerIndex], "with", peer);
        peers[existingPeerIndex] = peer;
    }
    else {
        peers.push(peer);
    }
    return peer;
}
let globalDC;
// This client receives a message
socket.on("message", async function (message) {
    console.log("Client received message:", message);
    // ? sent by peer after clicking call and getting user media
    if (message.message === "peerIsReady") {
        console.log(`***Peer ${message.userId} is ready`);
        let peer = setUpLocalPeer(message.userId);
        if (!peer) {
            return;
        }
        const dataChannel = peer.pc.createDataChannel("dataChannel", {});
        peer.dc = dataChannel;
        peer = addPeer(peer);
        const offerSessionDescription = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offerSessionDescription);
        console.log(`***Sending offer to peer ${message.userId}`);
        sendMessage(offerSessionDescription, peer.userId);
        dataChannel.onopen = (event) => {
            console.log("dataChannel onopen", { event });
        };
        dataChannel.onmessage = (event) => {
            console.log("dataChannel onmessage", event);
            handleDataChannelMessage(event);
        };
        dataChannel.onerror = (event) => {
            console.log("dataChannel onerror", event);
        };
    }
    else if (message.message.type ===
        "offer") {
        if (message.toUserId !== id) {
            console.log(`*** Offer not meant for me`);
            return;
        }
        console.log(`***Got offer from peer ${message.userId}`);
        let peer = setUpLocalPeer(message.userId);
        if (!peer) {
            alert("No peer for incoming offer");
            return;
        }
        peer = addPeer(peer);
        peer.pc.ondatachannel = (event) => {
            const dc = event.channel;
            dc.onopen = (event) => {
                console.log("^^^dataChannel onopen", { event });
            };
            dc.onmessage = (event) => {
                console.log("dataChannel onmessage 2", event);
                handleDataChannelMessage(event);
            };
            dc.onerror = (event) => {
                console.log("dataChannel onerror", event);
            };
            peers.find((p) => p.userId == message.userId).dc = dc;
        };
        await peer.pc.setRemoteDescription(new RTCSessionDescription(message.message));
        console.log(`***Sending answer to peer ${message.userId}`);
        const answerSessionDescription = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answerSessionDescription);
        sendMessage(answerSessionDescription, peer.userId);
    }
    else if (message.message.type ===
        "answer") {
        if (message.toUserId !== id) {
            console.log(`*** Answer not meant for me`);
            return;
        }
        console.log(`***Got answer from peer ${message.userId}`);
        generateNotification(`User ${message.userId} joined the session.`);
        const peer = peers.find((peer) => peer.userId === message.userId);
        if (!peer) {
            alert("couldn't find peer");
            return;
        }
        await peer.pc.setRemoteDescription(new RTCSessionDescription(message.message));
    }
    else if (message.message.type === "candidate") {
        const candidate = new RTCIceCandidate({
            sdpMLineIndex: message.message.label,
            candidate: message.message.candidate,
        });
        if (message.toUserId !== id) {
            return;
        }
        const peer = peers.find((peer) => peer.userId === message.userId);
        if (!peer) {
            alert("Peer not found");
            return;
        }
        console.log("Adding candidate");
        peer.pc.addIceCandidate(candidate);
    }
    else if (message.message === "bye") {
        handleRemoteHangup(message.userId);
    }
});
function sendMessage(message, toUserId) {
    console.log("Client sending message: ", message);
    const msg = {
        room,
        userId: id,
        message,
        toUserId,
    };
    socket.emit("message", msg);
}
window.onbeforeunload = function () {
    sendMessage("bye");
};
function hangup() {
    console.log("Hanging up.");
    peers.forEach((p) => p.pc.close());
    peers = [];
    sendMessage("bye");
    joinButton.disabled = false;
}
function handleRemoteHangup(userId) {
    document.getElementById(userId)?.remove();
    stopRemoteRTC(userId);
}
function stopRemoteRTC(userId) {
    const peerIndex = peers.findIndex((p) => (p.userId = userId));
    if (peerIndex == -1) {
        return;
    }
    peers[peerIndex].pc.close();
    peers.splice(peerIndex, 1);
}
function createOrGetUserDiv(id) {
    const existingDiv = document.getElementById(id);
    if (existingDiv) {
        return existingDiv;
    }
    const div = document.createElement("div");
    div.id = id;
    div.className = "remoteUser";
    const header = document.createElement("h2");
    header.innerText = `User ${id}`;
    div.appendChild(header);
    return div;
}
async function handleSqlInput(query) {
    // @ts-ignore
    const res = (await sql(query));
    if (res.resultRows) {
        const spreadsheetDiv = document.getElementById("spreadsheet-div");
        // @ts-ignore
        /*const tableHtml = (await table(res)) as string;
        spreadsheetDiv!.innerHTML = tableHtml;*/
        // @ts-ignore
        grid(data);
    }
}
async function handleDataChannelMessage(event) {
    // TODO: Handle out of order if messages can be delivered unorderd.
    const message = JSON.parse(event.data);
    if (typeof message.data == "string") {
        displayNewMessage({ userId: message.userId, data: message.data });
    }
    else {
        if (message.data.sql) {
            console.log({ sqlMessage: message });
            const sqlQuery = message.data.sql;
            handleSqlInput(sqlQuery);
        }
        else {
            const fragmentedMessage = message.data;
            const messageId = fragmentedMessage.messageId;
            if (!fragmentedMessages[messageId]) {
                fragmentedMessages[messageId] = [];
            }
            fragmentedMessages[messageId].push(...fragmentedMessage.chunk);
            notifyDataImportProgress(fragmentedMessage.messageId, fragmentedMessage.index, fragmentedMessage.length);
            if (fragmentedMessage.end) {
                console.log(`message ${messageId} is complete`);
                const type = fragmentedMessage.type;
                if (type == "TEXT") {
                    const textDecoder = new TextDecoder();
                    const numToUintArr = new Uint8Array(fragmentedMessages[messageId]);
                    const defragmentedMessage = textDecoder.decode(numToUintArr);
                    delete fragmentedMessages[messageId];
                    await handleSqlInput(defragmentedMessage);
                }
                else if (type == "BINARY") {
                    console.log("sql file received");
                    const root = await navigator.storage.getDirectory();
                    await root.removeEntry("db.sqlite3");
                    const newFile = await root.getFileHandle("db.sqlite3", {
                        create: true,
                    });
                    const writableStream = await newFile.createWritable();
                    const data = fragmentedMessages[messageId];
                    const uint = new Uint8Array(data);
                    const blob = new Blob([uint], { type: "application/vnd.sqlite3" });
                    await writableStream.write(blob); // takes array buffer or blob
                    await writableStream.close();
                }
            }
        }
    }
}
function notifyDataImportProgress(id, index, length) {
    const toastId = `toast-message-${id}`;
    length = length - 1;
    let message = "";
    if (index == 0) {
        message = "Importing started.";
        generateNotification(message, toastId);
        return;
    }
    else if (index == length) {
        message = "Import finished.";
    }
    else {
        message = `Import progress: ${Math.ceil((index / length) * 100)}%`;
    }
    updateNotification(message, toastId);
}
function generateNotification(message, id) {
    const html = `
      <div ${id ? `id="${id}"` : ""} class="toast show align-items-center" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">
            ${message}
          </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
  `;
    document.getElementById("toasts").innerHTML += html;
}
function updateNotification(message, id) {
    const toast = document.getElementById(id);
    toast.querySelector(".toast-body").innerHTML = message;
}
