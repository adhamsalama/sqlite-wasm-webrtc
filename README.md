Peer-to-peer collaborative database editing & sharing in the browser. No server required.

This project uses SQLite compiled to WebAssembly in the browser as the database, and provides collaborative funcionalities using WebRTC.

Evey peer has their own SQLite DB in their browser, and SQL statements are sent to peers using WebRTC, providing a private and secure way to share and manipulate data.

## Install

```sh
npm i
```

## Build

```sh
npm run build
```

## Run

```sh
node server.js
```

- Open a browser browser instance at [http://localhost:8080/index.html](http://localhost:8080/index.html).
- Click "Create Room" and enter a room name.
- Open another browser instance at the same URL.
- Click "Join Room" and enter the same room name.

Now you and your peers are connected using WebRTC.
Every query or file you import will be replicated to your peers.

This has the benefit of being private and secure because the database and the queries run on it are shared between you and you peers only.

I initially used [PGLite](https://pglite.dev/) which has excellent documentation and is very easy to use, but found it too heavy for this use case. SQLite is lighter and more suitable to running a database in the browser.

The docs for running SQLite in a web worker with persistance weren't easy, and I eventually had to add a bit of code to SQLite's WASM glue to make it easier to use.

I copied my existing WebRTC app project and removed unnecessary parts (video/audio/screen sharing), and kept DataChannels. So for more resources about WebRTC you can check my WebRTC repo.

## Resources

- [SQLite WebAssembly](https://sqlite.org/wasm/doc/trunk/index.md)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [WebRTC](https://github.com/adhamsalama/webrtc)
