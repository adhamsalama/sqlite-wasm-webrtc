"use strict";
const fragmentedMessages: Record<string, number[]> = {};

type Peer = {
  userId: string;
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  streams: Set<MediaStream>;
};
let peers: Peer[] = [];
let userIds: Set<string> = new Set();
const displayMediaOptions = undefined;

let id = Math.random().toString(16).slice(2);
(document.querySelector("#id") as HTMLHeadElement).innerText = id;

let room = "";

const constraints: MediaStreamConstraints = {
  video: false,
  audio: false,
};
const sdpConstraints = {
  offerToReceiveAudio: false,
  offerToReceiveVideo: false,
};
const roomName = document.getElementById("room") as HTMLHeadingElement;
const joinButton = document.getElementById("joinButton") as HTMLButtonElement;
const hangupButton = document.getElementById(
  "hangupButton"
) as HTMLButtonElement;
const messages = document.getElementById("messages") as HTMLUListElement;
const newMessage = document.getElementById("newMessage") as HTMLInputElement;
const sendMessageButton = document.getElementById(
  "sendMessage"
) as HTMLButtonElement;
let localScreenCaptureEnabled = false;
type FragmentedMessage = {
  messageId: string;
  end: boolean;
  chunk: number[];
  index: number;
  length: number;
};
type SqlMessage = { sql: string };
type DataChannelMessage = {
  userId: string;
  data: string | SqlMessage | FragmentedMessage;
};
type OutboundMessage =
  | RTCSessionDescriptionInit
  | RTCIceCandidateInit
  | CandidateMessage
  | "peerIsReady"
  | "bye";
type InboundMessage = {
  room: string;
  userId: string;
  toUserId?: string;
  message: OutboundMessage;
};

type CandidateMessage = {
  type: "candidate";
  label: number;
  id: string;
  candidate: string;
};
function createPeerConnection(userId: string): Peer | undefined {
  try {
    const localPeerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const peer: Peer = { userId, pc: localPeerConnection, streams: new Set() };
    localPeerConnection.onicecandidate = (event) => {
      console.log("icecandidate event: ", event);
      if (event.candidate) {
        sendMessage(
          {
            type: "candidate",
            label: event.candidate.sdpMLineIndex!,
            id: event.candidate.sdpMid!,
            candidate: event.candidate.candidate,
          },
          peer.userId
        );
      } else {
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
  } catch (e: any) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
}

function setUpLocalPeer(userId: string): Peer | undefined {
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

async function startCapture(displayMediaOptions: any) {
  let captureStream: MediaStream | null = null;

  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions
    );
  } catch (err) {
    console.error(`Error: ${err}`);
  }

  return captureStream;
}

// @ts-ignore
const socket = io.connect() as {
  emit: (to: string, data: any) => any;
  on: (event: string, cb: (...args: any[]) => any) => any;
};

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
function sendSqlMessageToPeers(query: string) {
  // Calculate the byte length
  const DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES = 16000; // 16 KB
  const encodedMessage = new TextEncoder().encode(query);
  console.log({ messageSize: encodedMessage.length });
  if (encodedMessage.length >= DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES) {
    console.log("message exceeds max size, fragmenting...");
    const numOfPackets = Math.ceil(
      encodedMessage.length / DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES
    );
    console.log({ numOfPackets });
    const messageBuffer: number[][] = [];
    let packetBuffer: number[] = [];
    for (let i = 0; i < encodedMessage.length; i++) {
      packetBuffer.push(encodedMessage[i]);
      if (
        packetBuffer.length == DATACHANNEL_MAX_MESSAGE_SIZE_IN_BYTES ||
        i == encodedMessage.length - 1
      ) {
        messageBuffer.push([...packetBuffer]);
        packetBuffer = [];
      }
    }
    const messageId = new Date().getMilliseconds().toString();
    console.log({ messageBufferSize: messageBuffer.length });
    peers.forEach((peer) => {
      messageBuffer.forEach((chunk, i) => {
        peer.dc?.send(
          // @ts-ignore
          JSON.stringify({
            userId: id,
            data: {
              chunk,
              messageId,
              index: i,
              length: messageBuffer.length,
              end: i < messageBuffer.length - 1 ? false : true,
            },
          } as DataChannelMessage)
        );
      });
    });
    return;
  }
  peers.forEach((peer) =>
    peer.dc?.send(
      JSON.stringify({ userId: id, data: { sql: query } } as DataChannelMessage)
    )
  );
}
sendMessageButton.onclick = () => {
  const message = newMessage.value;
  peers.forEach((peer) =>
    peer.dc?.send(
      JSON.stringify({ userId: id, data: message } as DataChannelMessage)
    )
  );
  newMessage.value = "";
  displayNewMessage({ userId: id, data: message }, "right");
};

socket.on("joined", function (room: string) {
  console.log("joined: " + room);
  joinButton.disabled = true;
});

function displayNewMessage(
  message: { userId: string; data: string },
  alignment: "left" | "right" = "left"
) {
  const newMessageElement = document.createElement("li");
  newMessageElement.style.textAlign = alignment;
  newMessageElement.innerHTML = `${message.userId} ${
    message.userId == id ? "(Me)" : ""
  }: ${message.data}`;
  messages.appendChild(newMessageElement);
  const hr = document.createElement("hr");
  messages.appendChild(hr);
}
function addPeer(peer: Peer): Peer {
  const existingPeerIndex = peers.findIndex((p) => p.userId == peer.userId);
  if (existingPeerIndex > -1) {
    peers[existingPeerIndex].pc.close();
    console.log(`^^^Replacing peer`, peers[existingPeerIndex], "with", peer);
    peers[existingPeerIndex] = peer;
  } else {
    peers.push(peer);
  }
  return peer;
}
let globalDC: RTCDataChannel;
// This client receives a message
socket.on("message", async function (message: InboundMessage) {
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
  } else if (
    (message.message as RTCSessionDescription & { toUserId: string }).type ===
    "offer"
  ) {
    if (message.toUserId !== id) {
      console.log(`*** Offer not mean for me`);
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
      dc.onmessage = (event: MessageEvent<string>) => {
        console.log("dataChannel onmessage 2", event);
        handleDataChannelMessage(event);
      };
      dc.onerror = (event) => {
        console.log("dataChannel onerror", event);
      };
      peers.find((p) => p.userId == message.userId)!.dc = dc;
    };

    await peer.pc.setRemoteDescription(
      new RTCSessionDescription(message.message as RTCSessionDescriptionInit)
    );
    console.log(`***Sending answer to peer ${message.userId}`);

    const answerSessionDescription = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answerSessionDescription);
    sendMessage(answerSessionDescription, peer.userId);
  } else if (
    (message.message as RTCSessionDescription & { toUserId: string }).type ===
    "answer"
  ) {
    if (message.toUserId !== id) {
      console.log(`*** Answer not meant for me`);
      return;
    }
    console.log(`***Got answer from peer ${message.userId}`);
    const peer = peers.find((peer) => peer.userId === message.userId);
    if (!peer) {
      alert("couldn't find peer");
      return;
    }
    await peer.pc.setRemoteDescription(
      new RTCSessionDescription(message.message as RTCSessionDescriptionInit)
    );
  } else if ((message.message as CandidateMessage).type === "candidate") {
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: (message.message as CandidateMessage).label,
      candidate: (message.message as CandidateMessage).candidate,
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
  } else if (message.message === "bye") {
    handleRemoteHangup(message.userId);
  }
});

function sendMessage(message: OutboundMessage, toUserId?: string) {
  console.log("Client sending message: ", message);
  const msg: InboundMessage = {
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

function handleRemoteHangup(userId: string) {
  document.getElementById(userId)?.remove();
  stopRemoteRTC(userId);
}

function stopRemoteRTC(userId: string) {
  const peerIndex = peers.findIndex((p) => (p.userId = userId));
  if (peerIndex == -1) {
    return;
  }
  peers[peerIndex].pc.close();
  peers.splice(peerIndex, 1);
}

function createOrGetUserDiv(id: string): HTMLDivElement {
  const existingDiv = document.getElementById(id) as HTMLDivElement | null;
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

async function handleSqlInput(query: string) {
  // @ts-ignore
  const res = (await sql(query)) as {
    resultRows: any[];
    columnNames: string[];
  };
  if (res.resultRows) {
    const spreadsheetDiv = document.getElementById("spreadsheet-div");
    // @ts-ignore
    const tableHtml = (await table(res)) as string;
    spreadsheetDiv!.innerHTML = tableHtml;
  }
}

async function handleDataChannelMessage(event: MessageEvent<any>) {
  // TODO: Handle out of order if messages can be delivered unorderd.
  const message = JSON.parse(event.data) as DataChannelMessage;
  if (typeof message.data == "string") {
    displayNewMessage({ userId: message.userId, data: message.data });
  } else {
    if ((message.data as SqlMessage).sql) {
      console.log({ sqlMessage: message });
      const sqlQuery = (message.data as SqlMessage).sql;
      handleSqlInput(sqlQuery);
    } else {
      const fragmentedMessage = message.data as FragmentedMessage;
      const messageId = fragmentedMessage.messageId;
      if (!fragmentedMessages[messageId]) {
        fragmentedMessages[messageId] = [];
      }
      fragmentedMessages[messageId].push(...fragmentedMessage.chunk);
      if (fragmentedMessage.end) {
        console.log(`message ${messageId} is complete`);
        const textDecoder = new TextDecoder();
        const numToUintArr = new Uint8Array(fragmentedMessages[messageId]);
        const defragmentedMessage = textDecoder.decode(numToUintArr);
        delete fragmentedMessages[messageId];
        await handleSqlInput(defragmentedMessage);
        alert("Import finishes successfully.");
      }
    }
  }
}
