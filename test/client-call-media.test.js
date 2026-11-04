import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireCallMedia, renderCallMediaToggles, releaseCallResources, toggleCallTrack } from '../src/client/call-media.js';

class FakeTrack {
  constructor(kind) { this.kind = kind; this.enabled = true; this.stopped = false; }
  stop() { this.stopped = true; }
}

class FakeMediaStream {
  constructor(tracks) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
}

function mediaHarness(responses) {
  const calls = [];
  const notices = [];
  const video = { srcObject: null, hidden: false };
  const mediaDevices = { getUserMedia: async (constraints) => {
    calls.push(constraints);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  } };
  return {
    calls, notices, video,
    acquire: (state, isCurrent = (candidate) => candidate === state) => acquireCallMedia(state, {
      mediaDevices,
      MediaStreamClass: FakeMediaStream,
      localVideo: video,
      isCurrent,
      showNotice: (message) => notices.push(message),
      mediaErrorMessage: (error, device) => `${device}: ${error.name}`,
    }),
  };
}

test('camera failure keeps the microphone call audio-only and reports the camera error', async () => {
  const microphone = new FakeTrack('audio');
  const harness = mediaHarness([
    { getTracks: () => [microphone] },
    Object.assign(new Error('camera denied'), { name: 'NotAllowedError' }),
  ]);
  const state = {};
  const stream = await harness.acquire(state);
  assert.deepEqual(harness.calls, [{ audio: true, video: false }, { audio: false, video: true }]);
  assert.deepEqual(stream.getTracks(), [microphone]);
  assert.equal(harness.video.srcObject, stream);
  assert.equal(harness.video.hidden, true);
  assert.match(harness.notices[0], /camera: NotAllowedError/);
  assert.equal(microphone.stopped, false);
});

test('microphone failure keeps the camera call video-capable and reports the microphone error', async () => {
  const camera = new FakeTrack('video');
  const harness = mediaHarness([
    Object.assign(new Error('microphone denied'), { name: 'NotAllowedError' }),
    { getTracks: () => [camera] },
  ]);
  const state = {};
  const stream = await harness.acquire(state);
  assert.deepEqual(stream.getTracks(), [camera]);
  assert.equal(harness.video.srcObject, stream);
  assert.equal(harness.video.hidden, false);
  assert.match(harness.notices[0], /microphone: NotAllowedError/);
});

test('both unavailable devices reject media acquisition with a device-specific message', async () => {
  const harness = mediaHarness([
    Object.assign(new Error(), { name: 'NotFoundError' }),
    Object.assign(new Error(), { name: 'NotReadableError' }),
  ]);
  await assert.rejects(harness.acquire({}), /microphone: NotFoundError camera: NotReadableError/);
  assert.equal(harness.video.srcObject, null);
  assert.deepEqual(harness.notices, []);
});

test('tracks acquired for a call that became stale are stopped and never attached to the new call UI', async () => {
  let resolveMedia;
  let activeCall;
  const audio = new FakeTrack('audio');
  const camera = new FakeTrack('video');
  const video = { srcObject: null, hidden: false };
  const remoteVideo = { srcObject: null, hidden: false };
  let requestedCamera = false;
  const oldPc = { closed: false, close() { this.closed = true; } };
  const callA = { id: 'A', pc: oldPc };
  const pending = acquireCallMedia(callA, {
    mediaDevices: { getUserMedia: (constraints) => {
      if (constraints.audio) return new Promise((resolve) => { resolveMedia = resolve; });
      requestedCamera = true;
      return Promise.resolve({ getTracks: () => [camera] });
    } },
    MediaStreamClass: FakeMediaStream,
    localVideo: video,
    isCurrent: (candidate) => activeCall === candidate,
  });
  activeCall = callA;
  await Promise.resolve();
  assert.equal(releaseCallResources(callA, { currentState: activeCall, localVideo: video, remoteVideo }), true);
  assert.equal(oldPc.closed, true);
  activeCall = { id: 'B', localStream: { owner: 'call B' } };
  const newPc = { closed: false, close() { this.closed = true; } };
  activeCall.pc = newPc;
  video.srcObject = activeCall.localStream;
  remoteVideo.srcObject = { owner: 'call B remote' };
  resolveMedia({ getTracks: () => [audio] });
  await assert.rejects(pending, /Cuộc gọi đã kết thúc/);
  assert.equal(audio.stopped, true);
  assert.equal(camera.stopped, false);
  assert.equal(requestedCamera, false);
  assert.equal(video.srcObject.owner, 'call B');
  assert.equal(remoteVideo.srcObject.owner, 'call B remote');
  assert.equal(newPc.closed, false);
  assert.equal(callA.localStream, undefined);
});

test('camera and microphone toggles update their tracks and UI independently', () => {
  const audio = new FakeTrack('audio');
  const video = new FakeTrack('video');
  const state = { status: 'connected', localStream: new FakeMediaStream([audio, video]) };
  const controls = ['audio', 'video'].map((kind) => ({
    kind,
    button: {
      hidden: true,
      textContent: '',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
    },
  }));
  const ui = Object.fromEntries(controls.map(({ kind, button }) => [
    kind === 'video' ? 'camera' : 'microphone', button,
  ]));
  const render = () => renderCallMediaToggles(state, controls);
  const assertButton = (button, text, pressed) => {
    assert.equal(button.hidden, false);
    assert.equal(button.textContent, text);
    assert.equal(button.attributes['aria-pressed'], pressed);
  };
  render();
  assertButton(ui.camera, 'Tắt camera', 'true');
  assertButton(ui.microphone, 'Tắt micro', 'true');

  assert.equal(toggleCallTrack(state, 'video', { onChange: render }), true);
  assert.equal(video.enabled, false);
  assert.equal(audio.enabled, true);
  assertButton(ui.camera, 'Bật camera', 'false');
  assertButton(ui.microphone, 'Tắt micro', 'true');

  assert.equal(toggleCallTrack(state, 'audio', { onChange: render }), true);
  assert.equal(audio.enabled, false);
  assert.equal(video.enabled, false);
  assertButton(ui.microphone, 'Bật micro', 'false');

  assert.equal(toggleCallTrack(state, 'video', { onChange: render }), true);
  assert.equal(video.enabled, true);
  assert.equal(audio.enabled, false);
  assertButton(ui.camera, 'Tắt camera', 'true');
});

test('cleanup closes the peer connection, clears callbacks, stops tracks, and detaches media elements', () => {
  const audio = new FakeTrack('audio');
  const camera = new FakeTrack('video');
  const localVideo = { srcObject: {}, hidden: true };
  const remoteVideo = { srcObject: {}, hidden: true };
  const pc = { onicecandidate() {}, ontrack() {}, onconnectionstatechange() {}, closed: false, close() { this.closed = true; } };
  const state = { pc, localStream: new FakeMediaStream([audio, camera]) };

  assert.equal(releaseCallResources(state, { localVideo, remoteVideo }), true);
  assert.equal(pc.closed, true);
  assert.equal(pc.onicecandidate, null);
  assert.equal(pc.ontrack, null);
  assert.equal(pc.onconnectionstatechange, null);
  assert.equal(audio.stopped, true);
  assert.equal(camera.stopped, true);
  assert.equal(localVideo.srcObject, null);
  assert.equal(remoteVideo.srcObject, null);
  assert.equal(localVideo.hidden, false);
  assert.equal(remoteVideo.hidden, false);
});

test('stale cleanup from call A cannot close or detach active call B resources', () => {
  const oldPc = { closed: false, close() { this.closed = true; } };
  const newPc = { closed: false, close() { this.closed = true; } };
  const callA = { pc: oldPc };
  const callB = { pc: newPc };
  const localVideo = { srcObject: { owner: 'B' } };
  const remoteVideo = { srcObject: { owner: 'B remote' } };
  const ui = { status: 'Call B connected', updates: 0 };

  assert.equal(releaseCallResources(callA, {
    currentState: callB,
    expectedState: callA,
    beforeRelease: () => { ui.updates += 1; },
    localVideo,
    remoteVideo,
  }), false);
  assert.equal(oldPc.closed, false);
  assert.equal(newPc.closed, false);
  assert.equal(localVideo.srcObject.owner, 'B');
  assert.equal(remoteVideo.srcObject.owner, 'B remote');
  assert.deepEqual(ui, { status: 'Call B connected', updates: 0 });
});
