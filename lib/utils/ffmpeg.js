// Class to handle child process used for running FFmpeg

const child_process = require('child_process');
const { EventEmitter } = require('events');

const { createSdpText } = require('./sdp');
const { convertStringToStream } = require('./utils');
const { getCodecInfoFromRtpParameters } = require('./utils');

const RECORD_FILE_LOCATION_PATH = process.env.RECORD_FILE_LOCATION_PATH || './out';
const MEDIA_FILE = "/Users/mozilla/Downloads/sample-mp4-file.mp4"

module.exports = class FFmpeg {

  constructor (peerId, inParams, outParams) {
    this._peerId = peerId;
    this._inParams = inParams;
    this._outParams = outParams;
    this._process = undefined;
    this._observer = new EventEmitter();
    this._createProcess();
  }

  _createProcess () {
    // const sdpString = createSdpText(this._inParams.rtpParams[0]);
    // const sdpStream = convertStringToStream(sdpString);

    // console.log('createProcess() [sdpString:%s]', sdpString);

    this._process = child_process.spawn('ffmpeg', this._commandArgs);

    if (this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');

      this._process.stderr.on('data', data =>
        console.log('ffmpeg::process::data [peerId:%o][data:%o]', this._peerId, data)
      );
    }

    if (this._process.stdout) {
      this._process.stdout.setEncoding('utf-8');

      this._process.stdout.on('data', data => 
        console.log('ffmpeg::process::data [peerId:%o][data:%o]', this._peerId, data)
        
      );
    }

    this._process.on('message', message =>
      console.log('ffmpeg::process::message [peerId:%o][message:%o]', this._peerId, message)
    );

    this._process.on('error', error =>
      console.error('ffmpeg::process::error [peerId:%o][error:%o]', this._peerId, error)
    );

    this._process.once('close', () => {
      console.log('ffmpeg::process::close [peerId:%o]', this._peerId);
      this._observer.emit('process-close');
    });

    // sdpStream.on('error', error =>
    //   console.error('sdpStream::error [error:%o]', error)
    // );

    // // Pipe sdp stream to the ffmpeg process
    // sdpStream.resume();
    // sdpStream.pipe(this._process.stdin);
  }

  close () {
    console.log('kill() [peerId:%o][pid:%d]', this._peerId, this._process.pid);
    this._process.kill('SIGKILL');
  }

  get _commandArgs () {
    // let commandArgs = [
    //   "-re",
    //   "-v",
    //   "info", 
    //   "-stream_loop",
    //   "1",
    //   "-i",
    //   `${MEDIA_FILE}`,
    //   "-map",
    //   "0:a:0",
    //   "-acodec",
    //   "libopus",
    //   "-ab",
    //   "128k",
    //   "-ac",
    //   "2",
    //   "-ar",
    //   "48000",
    //   "-vn",
    //   "-f",
    //   "tee",
    //   `[select=a:f=rtp:ssrc=${this._outParams.ssrc}:payload_type=${this._outParams.payload_type}]rtp://${this._outParams.audioTransportIp}:${this._outParams.audioTransportPort}?rtcpport=${this._outParams.audioTransportRtcpPort}&localrtpport=${this._outParams.localRtpPort}&localrtcpport=${this._outParams.localRtcpPort}`];

    let commandArgs = [
      '-re',
      '-loglevel',
      'debug',
      '-nostdin',
      '-protocol_whitelist',
      'data,pipe,udp,rtp',
      '-fflags',
      '+genpts',
      '-flags',
      'low_delay',
      '-thread_queue_size',
      '10240',
      '-use_wallclock_as_timestamps',
      'true'
    ];

    const mixPostOpts = [];
    const mixPreOpts = [];
    for (let i=0; i<this._inParams.length; i++) {
      mixPreOpts.push(`[${i}]highpass=f=200,lowpass=f=3000,aresample=async=1,volume=${this._inParams.length}[${String.fromCharCode(97+i)}];`);
      mixPostOpts.push(`[${String.fromCharCode(97+i)}]`);
    }

    // Add input SDPs
    for (const rtpParams of this._inParams) {
      commandArgs.push('-i');
      commandArgs.push(this.createSdp(rtpParams));
    }

    commandArgs = commandArgs.concat([
      '-filter_complex',
      `${mixPreOpts.join("")}${mixPostOpts.join("")}amix=inputs=${this._inParams.length}:duration=longest:dropout_transition=0`
    ]);

    commandArgs = commandArgs.concat(this._inputArgs);
    commandArgs = commandArgs.concat(this._outputArgs);

    // commandArgs = commandArgs.concat([
    //   '-flags',
    //   '+global_header',
    //   `${RECORD_FILE_LOCATION_PATH}/${this._inParams.fileName}.webm`
    // ]);

    console.log('commandArgs:%o', commandArgs);

    return commandArgs;
  }

  createSdp(rtpParams) {
    const audioCodecInfo = getCodecInfoFromRtpParameters('audio', rtpParams.rtpParameters);
    return `data:application/sdp;charset=UTF-8,v=0\no=- 0 0 IN IP4 127.0.0.1\ns=FFmpeg\nc=IN IP4 127.0.0.1\nt=0 0\nm=audio ${rtpParams.remoteRtpPort} RTP/AVP ${audioCodecInfo.payloadType}\na=rtpmap:${audioCodecInfo.payloadType} ${audioCodecInfo.codecName}/${audioCodecInfo.clockRate}/${audioCodecInfo.channels}\na=sendonly`;
  }

  get _inputArgs () {
    return [
      '-strict',
      'experimental',
      '-c:a',
      'libopus',
      '-ac',
      '1',
      '-ar',
      '48000',
      '-b:a',
      '16K',
      '-vbr',
      'constrained'
    ];
  }

  get _outputArgs () {
    return [
      '-f',
      'tee',
      `[select=a:f=rtp:ssrc=${this._outParams.ssrc}:payload_type=${this._outParams.payload_type}]rtp://127.0.0.1:${this._outParams.audioTransportPort}?rtcpport=${this._outParams.audioTransportRtcpPort}&localrtpport=${this._outParams.localRtpPort}&localrtcpport=${this._outParams.localRtcpPort}`
    ];
  }
}
