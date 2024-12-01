import React, { useEffect, useRef, useState } from 'react';
import { createPeer } from '../utils/peerService';
import { db } from '../utils/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import Draggable from 'react-draggable';
import '../styles/components/VideoConference.css';

const VideoConference = ({ username }) => {
  const [peer, setPeer] = useState(null);
  const [peers, setPeers] = useState({});
  const [calls, setCalls] = useState([]);
  const localVideoRef = useRef(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [roomId, setRoomId] = useState('main');
  const streamRef = useRef(null);

  useEffect(() => {
    const initPeer = async () => {
      const newPeer = createPeer();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Handle incoming calls
        newPeer.on('call', call => {
          call.answer(stream);
          handleCall(call);
        });

        // Add peer ID to Firebase
        const peerRef = ref(db, `videoRooms/${roomId}/peers/${username}`);
        set(peerRef, {
          peerId: newPeer.id,
          timestamp: Date.now()
        });

        // Remove peer when disconnecting
        window.addEventListener('beforeunload', () => {
          remove(peerRef);
        });

        setPeer(newPeer);

        // Listen for other peers
        const roomRef = ref(db, `videoRooms/${roomId}/peers`);
        onValue(roomRef, (snapshot) => {
          const peersData = snapshot.val() || {};
          setPeers(peersData);

          // Call new peers
          Object.entries(peersData).forEach(([peerUsername, peerData]) => {
            if (peerUsername !== username && !calls.find(c => c.peer === peerData.peerId)) {
              const call = newPeer.call(peerData.peerId, stream);
              handleCall(call, peerUsername);
            }
          });
        });

      } catch (err) {
        console.error('Failed to get media devices:', err);
      }
    };

    initPeer();

    return () => {
      // Cleanup
      streamRef.current?.getTracks().forEach(track => track.stop());
      peer?.destroy();
      remove(ref(db, `videoRooms/${roomId}/peers/${username}`));
    };
  }, [username, roomId]);

  const handleCall = (call, peerUsername = 'Unknown') => {
    call.on('stream', remoteStream => {
      setCalls(prev => {
        // Remove any existing call with the same peer
        const filtered = prev.filter(c => c.peer !== call.peer);
        return [...filtered, {
          call,
          stream: remoteStream,
          peer: call.peer,
          username: peerUsername
        }];
      });
    });

    call.on('close', () => {
      setCalls(prev => prev.filter(c => c.peer !== call.peer));
    });
  };

  const toggleVideo = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoEnabled;
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleAudio = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioEnabled;
      setAudioEnabled(!audioEnabled);
    }
  };

  const joinRoom = (newRoomId) => {
    // Leave current room
    remove(ref(db, `videoRooms/${roomId}/peers/${username}`));
    // Join new room
    setRoomId(newRoomId);
  };

  return (
    <>
      <Draggable>
        <div className="video-conference-container" style={{ zIndex: 1010 }}>
          <div className="video-conference" style={{ width: '100%', height: '100%', padding: 0, margin: 0 }}>
            <div className="room-controls">
              <select
                value={roomId}
                onChange={(e) => joinRoom(e.target.value)}
                className="room-selector"
              >
                <option value="main">Main Room</option>
                <option value="room1">Room 1</option>
                <option value="room2">Room 2</option>
                <option value="room3">Room 3</option>
              </select>
              <span className="room-info">Current Room: {roomId}</span>
            </div>
            <div className="video-grid" style={{ width: '100%', height: '100%', padding: 0, margin: 0 }}>
              <div className="video-container local" style={{ width: '100%', height: '100%', padding: 0, margin: 0 }}>
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
                <div className="video-label" style={{ position: 'absolute', top: '0', left: '0', padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}>You ({username})</div>
                <div className="video-controls" style={{ position: 'absolute', bottom: '10px', left: '10px' }}>
                  <button onClick={toggleVideo} className={`control-btn ${!videoEnabled ? 'disabled' : ''}`}>
                    {videoEnabled ? '🎥' : '❌'}
                  </button>
                  <button onClick={toggleAudio} className={`control-btn ${!audioEnabled ? 'disabled' : ''}`}>
                    {audioEnabled ? '🎤' : '🔇'}
                  </button>
                </div>
              </div>
              {calls.map((call, index) => (
                <div key={index} className="video-container remote" style={{ width: '100%', height: '100%', padding: 0, margin: 0 }}>
                  <video
                    autoPlay
                    playsInline
                    ref={video => {
                      if (video) video.srcObject = call.stream;
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                  />
                  <div className="video-label" style={{ position: 'absolute', top: '0', left: '0', padding: '10px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}>{call.username}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Draggable>
    </>
  );
};

export default VideoConference;
