import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';

export const createPeer = () => {
  return new Peer(uuidv4(), {
    host: 'peerjs.com',
    port: 443,
    path: '',
    secure: true
  });
};