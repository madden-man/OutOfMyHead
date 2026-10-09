/// <reference types="node" />
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

// jsdom's Blob does not survive structured clone, so fake-indexeddb would store
// it as an empty object. Node's Blob and File do, like a browser's. This runs
// before Dexie loads, because Dexie records the Blob class it must not clone.
Object.assign(globalThis, { Blob: NodeBlob, File: NodeFile });
