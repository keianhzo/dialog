const { getCodecInfoFromRtpParameters } = require('./utils');

// File to create SDP text from mediasoup RTP Parameters
module.exports.createSdpText = (params) => { 
  // Audio codec info
  const audioCodecInfo = getCodecInfoFromRtpParameters('audio', params.rtpParameters);

  return `v=0
  o=- 0 0 IN IP4 127.0.0.1
  s=FFmpeg
  c=IN IP4 127.0.0.1
  t=0 0
  m=audio ${params.remoteRtpPort} RTP/AVP ${audioCodecInfo.payloadType} 
  a=rtpmap:${audioCodecInfo.payloadType} ${audioCodecInfo.codecName}/${audioCodecInfo.clockRate}/${audioCodecInfo.channels}
  a=sendonly
  `;
};
