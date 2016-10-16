/*******************************************************************************
 * Copyright (c) 1999, 2014 IBM Corp.
 * <p>
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * and Eclipse Distribution License v1.0 which accompany this distribution.
 * <p>
 * The Eclipse Public License is available at
 * http://www.eclipse.org/legal/epl-v10.html
 * and the Eclipse Distribution License is available at
 * http://www.eclipse.org/org/documents/edl-v10.php.
 */
package org.eclipse.paho.android.service.sample;

import android.content.Context;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Message;
import android.support.v4.app.Fragment;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.RadioGroup;
import android.widget.Toast;

import com.baidu.tts.auth.AuthInfo;
import com.baidu.tts.client.SpeechError;
import com.baidu.tts.client.SpeechSynthesizer;
import com.baidu.tts.client.SpeechSynthesizerListener;
import com.baidu.tts.client.TtsMode;
import com.microsoft.cognitiveservices.speechrecognition.DataRecognitionClient;
import com.microsoft.cognitiveservices.speechrecognition.ISpeechRecognitionServerEvents;
import com.microsoft.cognitiveservices.speechrecognition.MicrophoneRecognitionClient;
import com.microsoft.cognitiveservices.speechrecognition.RecognitionResult;
import com.microsoft.cognitiveservices.speechrecognition.RecognitionStatus;
import com.microsoft.cognitiveservices.speechrecognition.SpeechRecognitionMode;
import com.microsoft.cognitiveservices.speechrecognition.SpeechRecognitionServiceFactory;

import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttSecurityException;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;


/**
 * Fragment for the publish message pane.
 */
public class PublishFragment extends Fragment implements ISpeechRecognitionServerEvents, SpeechSynthesizerListener {

    private View view;
    private Button button_publish;
    private EditText topicEditText;
    private EditText messageEditText;
    private RadioGroup qosRadioGroup;
    private CheckBox retainedCheckBox;

    private int m_waitSeconds = 0;
    DataRecognitionClient dataClient = null;
    MicrophoneRecognitionClient micClient = null;
    FinalResponseStatus isReceivedResponse = FinalResponseStatus.NotReceived;
    private boolean isTouch = false;
    private String command = null;
    private Context context = null;

    String[] HOME = {"灯", "空调", "电视机", "窗帘"};
    String[] STATUS = {"开", "关"};

    // 语音合成
    private SpeechSynthesizer mSpeechSynthesizer;
    String TAG = "PublishFragment.class";
    private static final int PRINT = 0;
    final static String UNKNOW_TIP = "对不起，我没听懂您在说什么！";
    final static String RUNNING_TIP = "正在执行您的指令...";
    final static String INTERUPTER_TIP = "对不起，由于系统问题，您的指令无法正常执行。";

    private String mSampleDirPath;
    private static final String SAMPLE_DIR_NAME = "baiduTTS";
    private static final String SPEECH_FEMALE_MODEL_NAME = "bd_etts_speech_female.dat";
    private static final String SPEECH_MALE_MODEL_NAME = "bd_etts_speech_male.dat";
    private static final String TEXT_MODEL_NAME = "bd_etts_text.dat";
    private static final String LICENSE_FILE_NAME = "temp_license";
    private static final String ENGLISH_SPEECH_FEMALE_MODEL_NAME = "bd_etts_speech_female_en.dat";
    private static final String ENGLISH_SPEECH_MALE_MODEL_NAME = "bd_etts_speech_male_en.dat";
    private static final String ENGLISH_TEXT_MODEL_NAME = "bd_etts_text_en.dat";

    private Handler mHandler = new Handler() {

        /*
         * @param msg
         */
        @Override
        public void handleMessage(Message msg) {
            super.handleMessage(msg);
            int what = msg.what;
            switch (what) {
                case PRINT:
                    print(msg);
                    break;

                default:
                    break;
            }
        }

    };

    private void speak(String text) {
//        String text = "对不起，我没听懂您在说什么！";
        //需要合成的文本text的长度不能超过1024个GBK字节。
        int result = this.mSpeechSynthesizer.speak(text);
        System.out.println(result);
        if (result < 0) {
            System.out.println("error,please look up error code in doc or URL:http://yuyin.baidu.com/docs/tts/122 ");
        }
    }

    private void print(Message msg) {
        String message = (String) msg.obj;
        if (message != null) {
            Log.w(TAG, message);
            Toast.makeText(this.getActivity(), message, Toast.LENGTH_SHORT).show();
//            scrollLog(message);
        }
    }

    @Override
    public void onSynthesizeStart(String s) {

    }

    @Override
    public void onSynthesizeDataArrived(String s, byte[] bytes, int i) {

    }

    @Override
    public void onSynthesizeFinish(String s) {

    }

    @Override
    public void onSpeechStart(String s) {

    }

    @Override
    public void onSpeechProgressChanged(String s, int i) {

    }

    @Override
    public void onSpeechFinish(String s) {

    }

    @Override
    public void onError(String s, SpeechError speechError) {

    }

    public enum FinalResponseStatus {NotReceived, OK, Timeout}


    /**
     * @see android.support.v4.app.Fragment#onCreateView(android.view.LayoutInflater, android.view.ViewGroup, android.os.Bundle)
     */
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        view = inflater.inflate(R.layout.activity_publish, container, false);
//        initMicClient();
        context = this.getActivity();

        PublishButtonListener publishButtonListener = new PublishButtonListener();
        button_publish = (Button) view.findViewById(R.id.button_publish);
        button_publish.setOnTouchListener(publishButtonListener);
        final PublishFragment This = this;

        topicEditText = (EditText) view.findViewById(R.id.lastWillTopic);
        messageEditText = (EditText) view.findViewById(R.id.lastWill);
        qosRadioGroup = (RadioGroup) view.findViewById(R.id.qosRadio);
        retainedCheckBox = (CheckBox) view.findViewById(R.id.retained);

        initialEnv();
        initTts();


        return view;

    }

    private void initialEnv() {
        if (mSampleDirPath == null) {
            String sdcardPath = Environment.getExternalStorageDirectory().toString();
            mSampleDirPath = sdcardPath + "/" + SAMPLE_DIR_NAME;
        }
        makeDir(mSampleDirPath);
        copyFromAssetsToSdcard(false, SPEECH_FEMALE_MODEL_NAME, mSampleDirPath + "/" + SPEECH_FEMALE_MODEL_NAME);
        copyFromAssetsToSdcard(false, SPEECH_MALE_MODEL_NAME, mSampleDirPath + "/" + SPEECH_MALE_MODEL_NAME);
        copyFromAssetsToSdcard(false, TEXT_MODEL_NAME, mSampleDirPath + "/" + TEXT_MODEL_NAME);
        copyFromAssetsToSdcard(false, LICENSE_FILE_NAME, mSampleDirPath + "/" + LICENSE_FILE_NAME);
        copyFromAssetsToSdcard(false, "english/" + ENGLISH_SPEECH_FEMALE_MODEL_NAME, mSampleDirPath + "/"
                + ENGLISH_SPEECH_FEMALE_MODEL_NAME);
        copyFromAssetsToSdcard(false, "english/" + ENGLISH_SPEECH_MALE_MODEL_NAME, mSampleDirPath + "/"
                + ENGLISH_SPEECH_MALE_MODEL_NAME);
        copyFromAssetsToSdcard(false, "english/" + ENGLISH_TEXT_MODEL_NAME, mSampleDirPath + "/"
                + ENGLISH_TEXT_MODEL_NAME);
    }

    /**
     * 将sample工程需要的资源文件拷贝到SD卡中使用（授权文件为临时授权文件，请注册正式授权）
     *
     * @param isCover 是否覆盖已存在的目标文件
     * @param source
     * @param dest
     */
    private void copyFromAssetsToSdcard(boolean isCover, String source, String dest) {
        File file = new File(dest);
        if (isCover || (!isCover && !file.exists())) {
            InputStream is = null;
            FileOutputStream fos = null;
            try {
                is = this.getResources().getAssets().open(source);
                String path = dest;
                fos = new FileOutputStream(path);
                byte[] buffer = new byte[1024];
                int size = 0;
                while ((size = is.read(buffer, 0, 1024)) >= 0) {
                    fos.write(buffer, 0, size);
                }
            } catch (FileNotFoundException e) {
                e.printStackTrace();
            } catch (IOException e) {
                e.printStackTrace();
            } finally {
                if (fos != null) {
                    try {
                        fos.close();
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }
                try {
                    if (is != null) {
                        is.close();
                    }
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    private void makeDir(String dirPath) {
        File file = new File(dirPath);
        if (!file.exists()) {
            file.mkdirs();
        }
    }

    public void initTts(){
        this.mSpeechSynthesizer = SpeechSynthesizer.getInstance();
        this.mSpeechSynthesizer.setContext(this.getActivity());
        this.mSpeechSynthesizer.setSpeechSynthesizerListener(this);
        this.mSpeechSynthesizer.setParam(SpeechSynthesizer.PARAM_TTS_TEXT_MODEL_FILE, mSampleDirPath + "/"
                + TEXT_MODEL_NAME);
        // 声学模型文件路径 (离线引擎使用)
        this.mSpeechSynthesizer.setParam(SpeechSynthesizer.PARAM_TTS_SPEECH_MODEL_FILE, mSampleDirPath + "/"
                + SPEECH_FEMALE_MODEL_NAME);
        this.mSpeechSynthesizer.setAppId(ActivityConstants.baiduAppID);
        this.mSpeechSynthesizer.setApiKey(ActivityConstants.baiduAppID, ActivityConstants.baiduSecretKey);
        this.mSpeechSynthesizer.setParam(SpeechSynthesizer.PARAM_SPEAKER, "0");
        this.mSpeechSynthesizer.setParam(SpeechSynthesizer.PARAM_VOLUME, "8");
        mSpeechSynthesizer.setParam(SpeechSynthesizer.PARAM_PITCH, "5");


        this.mSpeechSynthesizer.setParam(SpeechSynthesizer.PARAM_MIX_MODE, SpeechSynthesizer.MIX_MODE_HIGH_SPEED_NETWORK);
        // 授权检测接口(只是通过AuthInfo进行检验授权是否成功。)
        // AuthInfo接口用于测试开发者是否成功申请了在线或者离线授权，如果测试授权成功了，可以删除AuthInfo部分的代码（该接口首次验证时比较耗时），不会影响正常使用（合成使用时SDK内部会自动验证授权）
        AuthInfo authInfo = this.mSpeechSynthesizer.auth(TtsMode.MIX);

        if (authInfo.isSuccess()){
            System.out.println("auth success");
        }else {
            String errorMsg = authInfo.getTtsError().getDetailMessage();
            System.out.println("auth failed errorMsg="+errorMsg);
        }

        mSpeechSynthesizer.initTts(TtsMode.ONLINE);


    }

    @Override
    public void onPartialResponseReceived(String s) {

    }

    @Override
    public void onFinalResponseReceived(final RecognitionResult response) {
        boolean isFinalDicationMessage = this.getMode() == SpeechRecognitionMode.LongDictation &&
                (response.RecognitionStatus == RecognitionStatus.EndOfDictation ||
                        response.RecognitionStatus == RecognitionStatus.DictationEndSilenceTimeout);
        if (null != this.micClient && this.getUseMicrophone() && ((this.getMode() == SpeechRecognitionMode.ShortPhrase) || isFinalDicationMessage)) {
            // we got the final result, so it we can end the mic reco.  No need to do this
            // for dataReco, since we already called endAudio() on it as soon as we were done
            // sending all the data.
            this.micClient.endMicAndRecognition();
        }

        if (isFinalDicationMessage) {
            this.isReceivedResponse = FinalResponseStatus.OK;
        }

        if (!isFinalDicationMessage) {
            if (response.Results.length > 0) {
                this.command = response.Results[0].DisplayText;
                System.out.println("response:========" + this.command);
                processCommand(this.command);
            }
            /*for (int i = 0; i < response.Results.length; i++) {
                this.WriteLine("[" + i + "]" + " Confidence=" + response.Results[i].Confidence +
                        " Text=\"" + response.Results[i].DisplayText + "\"");
            }*/

        }
    }

    @Override
    public void onIntentReceived(String s) {

    }

    @Override
    public void onError(int i, String s) {

    }

    @Override
    public void onAudioEvent(boolean recording) {
        if (recording) {

        } else {
            this.micClient.endMicAndRecognition();
        }
    }

    class PublishButtonListener implements View.OnTouchListener {

        @Override
        public boolean onTouch(View view, MotionEvent motionEvent) {

            switch (view.getId()) {
                case R.id.button_publish:
                    int eventAction = motionEvent.getAction();
                    if (eventAction == MotionEvent.ACTION_DOWN) {
                        if (PublishFragment.this.micClient == null) {
                            PublishFragment.this.initMicClient();
                        }
                        PublishFragment.this.micClient.startMicAndRecognition();
                        PublishFragment.this.isTouch = true;
                    } else if (eventAction == MotionEvent.ACTION_UP) {
//                        PublishFragment.this.micClient.endMicAndRecognition();
                        PublishFragment.this.isTouch = false;
//                        System.out.println(PublishFragment.this.command);
//                        processCommand(PublishFragment.this.command);

                    } else if (eventAction == MotionEvent.ACTION_MOVE) {
                        if (PublishFragment.this.isTouch != true) {
                            PublishFragment.this.micClient.startMicAndRecognition();
                            PublishFragment.this.isTouch = true;
                        }
                    }
                    break;
            }

            return true;
        }
    }

    private void initMicClient() {
        this.m_waitSeconds = this.getMode() == SpeechRecognitionMode.ShortPhrase ? 20 : 30;
        String language = this.getDefaultLocale();
        if (this.getUseMicrophone()) {
            if (this.micClient == null) {
                if (this.getWantIntent()) {
                    this.micClient = SpeechRecognitionServiceFactory.createMicrophoneClientWithIntent(this.getActivity(), language, this, this.getPrimaryKey(), this.getLuisAppId(), this.getLuisSubscriptionID());

                } else {
                    this.micClient = SpeechRecognitionServiceFactory.createMicrophoneClient(
                            this.getActivity(),
                            this.getMode(),
                            language,
                            this,
                            this.getPrimaryKey());
                }
            }
        }

    }

    public void processCommand(String commandStr) {
        if (commandStr == null) {
            this.speak(this.UNKNOW_TIP);
            return;
        }
        String home = null;
        Integer status = 2;
        if (commandStr.contains("灯")) {
            home = "light";
            status = openSwitch(commandStr);
        } else if (commandStr.contains("空调")) {
            home = "air_condition";
            status = openSwitch(commandStr);
        } else if (commandStr.contains("电视") || commandStr.contains("TV") || commandStr.contains("电视机")) {
            home = "tv";
            status = openSwitch(commandStr);
        } else if (commandStr.contains("窗") || commandStr.contains("窗帘")) {
            home = "window";
            status = openSwitch(commandStr);
        } else {
            // 语音提示 “您说的什么？我没听懂。”
            this.speak(this.UNKNOW_TIP);
        }

        if (home != null && status != 2) {
            String topic = home;
            topicEditText.setText(topic);
            String message = status.toString();
            messageEditText.setText(message);
            int qos = ActivityConstants.defaultQos;
            int checked = qosRadioGroup.getCheckedRadioButtonId();
            switch (checked) {
                case R.id.qos0:
                    qos = 0;
                    break;
                case R.id.qos1:
                    qos = 1;
                    break;
                case R.id.qos2:
                    qos = 2;
                    break;
            }
            boolean retained = retainedCheckBox.isChecked();
            String clientHandle = ActivityConstants.clientHandlerURL;
            String[] args = new String[2];
            args[0] = message;
            args[1] = topic + ";qos:" + qos + ";retained:" + retained;

            try {

                Connections.getInstance(context).getConnection(clientHandle).getClient()
                        .publish(topic, message.getBytes(), qos, retained, null, new ActionListener(context, ActionListener.Action.PUBLISH, clientHandle, args));
                this.speak(this.RUNNING_TIP);
            } catch (MqttSecurityException e) {
                this.speak(this.INTERUPTER_TIP);
                Log.e(this.getClass().getCanonicalName(), "Failed to publish a messged from the client with the handle " + clientHandle, e);
            } catch (MqttException e) {
                this.speak(this.INTERUPTER_TIP);
                Log.e(this.getClass().getCanonicalName(), "Failed to publish a messged from the client with the handle " + clientHandle, e);
            }
        }


    }

    public int openSwitch(String commandStr) {
        int status = 2;
        if (commandStr.contains("开")) {
            status = 1;
        } else if (commandStr.contains("关")) {
            status = 0;
        }
        return status;
    }

    public String getPrimaryKey() {
        return this.getString(R.string.primaryKey);
    }

    private String getLuisAppId() {
        return "yourLuisAppID";
    }

    private String getLuisSubscriptionID() {
        return this.getString(R.string.luisSubscriptionID);
    }

    private Boolean getUseMicrophone() {
        return true;
    }

    private Boolean getWantIntent() {
        return true;
    }

    private SpeechRecognitionMode getMode() {
        /*int id = this._radioGroup.getCheckedRadioButtonId();
        if (id == R.id.micDictationRadioButton ||
                id == R.id.dataLongRadioButton) {
            return SpeechRecognitionMode.LongDictation;
        }*/

        return SpeechRecognitionMode.ShortPhrase;
    }

    private String getDefaultLocale() {
        return "zh-CN";
    }



}
