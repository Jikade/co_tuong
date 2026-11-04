
	// Xin quyền camera/microphone, quản lý MediaStream

// [VIDEO - XIN QUYỀN VÀ TẠO MEDIASTREAM]
// getUserMedia xin audio và video riêng để cuộc gọi vẫn tiếp tục nếu chỉ một thiết bị khả dụng.
// Các track được ghép thành MediaStream, gắn vào video cục bộ và sau đó chuyển cho RTCPeerConnection.
export async function acquireCallMedia(state, {
  mediaDevices = globalThis.navigator?.mediaDevices,
  MediaStreamClass = globalThis.MediaStream,
  localVideo,
  isCurrent = () => true,
  showNotice = () => {},
  mediaErrorMessage = (error, device) => `Không thể bật ${device}: ${error?.message ?? 'lỗi thiết bị'}`,
} = {}) {
  if (state.localStream) return state.localStream;
  if (!mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt này không hỗ trợ API camera/microphone (getUserMedia). Hãy dùng Safari bản mới nhất.');
  }

  const tracks = [];
  const failures = [];
  for (const [kind, device] of [['audio', 'microphone'], ['video', 'camera']]) {
    try {
      const stream = await mediaDevices.getUserMedia({ audio: kind === 'audio', video: kind === 'video' });
      tracks.push(...stream.getTracks());
    } catch (error) {
      failures.push(mediaErrorMessage(error, device));
    }
    if (!isCurrent(state)) {
      tracks.forEach((track) => track.stop());
      throw new Error('Cuộc gọi đã kết thúc.');
    }
  }
  if (!tracks.length) throw new Error(failures.join(' '));
  state.localStream = new MediaStreamClass(tracks);
  state.mediaErrors = failures;
  if (failures.length) showNotice(`${failures.join(' ')} Cuộc gọi sẽ tiếp tục với thiết bị còn hoạt động.`);
  if (localVideo) {
    localVideo.srcObject = state.localStream;
    localVideo.hidden = !state.localStream.getVideoTracks().length;
  }
  return state.localStream;
}

export function toggleCallTrack(state, kind, {
  showNotice = () => {},
  mediaErrorMessage = (error, device) => `Không thể bật ${device}: ${error?.message ?? 'lỗi thiết bị'}`,
  onChange = () => {},
} = {}) {
  if (!state || state.status !== 'connected') return false;
  const tracks = kind === 'video' ? state.localStream?.getVideoTracks() : state.localStream?.getAudioTracks();
  if (!tracks?.length) {
    showNotice(mediaErrorMessage({ name: 'NotFoundError' }, kind === 'video' ? 'camera' : 'microphone'));
    return false;
  }
  const enabled = !tracks.some((track) => track.enabled);
  tracks.forEach((track) => { track.enabled = enabled; });
  onChange(state, kind, enabled);
  return true;
}

export function renderCallMediaToggles(state, controls) {
  for (const { kind, button } of controls) {
    const tracks = state?.localStream?.getTracks().filter((track) => track.kind === kind) ?? [];
    button.hidden = !tracks.length;
    const enabled = tracks.some((track) => track.enabled);
    button.textContent = `${enabled ? 'Tắt' : 'Bật'} ${kind === 'audio' ? 'micro' : 'camera'}`;
    button.setAttribute('aria-pressed', String(enabled));
  }
}

// [VIDEO - GIẢI PHÓNG THIẾT BỊ]
// Đóng RTCPeerConnection, dừng các MediaStreamTrack (nhả camera/micro) và xóa nguồn video khi cuộc gọi kết thúc.
export function releaseCallResources(state, {
  currentState = state,
  expectedState = null,
  beforeRelease = () => {},
  localVideo,
  remoteVideo,
} = {}) {
  if (expectedState && currentState !== expectedState) return false;
  beforeRelease();
  if (state?.pc) {
    state.pc.onicecandidate = null;
    state.pc.ontrack = null;
    state.pc.onconnectionstatechange = null;
    state.pc.close();
  }
  state?.localStream?.getTracks().forEach((track) => track.stop());
  for (const video of [localVideo, remoteVideo]) {
    if (!video) continue;
    video.srcObject = null;
    video.hidden = false;
  }
  return true;
}
