/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable import/no-unresolved */
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useRef, useEffect } from 'react';
import {
  Input as InputComponent,
  Attachment,
  IconButton,
  useNotificationDispatch,
  Remove,
  Label,
} from 'amazon-chime-sdk-component-library-react';

import {
  sendChannelMessage,
  getChannelMessage,
} from '../../api/ChimeAPI';
import formatBytes from '../../utilities/formatBytes';
import './Input.css';
import AttachmentService from '../../services/AttachmentService';
import { useChatMessagingState } from '../../providers/ChatMessagesProvider';

const uploadObjDefaults = {
  name: '',
  file: '',
  type: '',
  response: null,
  key: '',
};

import { useAuthContext } from '../../providers/AuthProvider';

const Input = ({ activeChannelArn, member, hasMembership }) => {
  const [text, setText] = useState('');
  const inputRef = useRef();
  const uploadRef = useRef();
  const [uploadObj, setUploadObj] = useState(uploadObjDefaults);
  const notificationDispatch = useNotificationDispatch();
  const { messages, setMessages } = useChatMessagingState();

  const { isAnonymous } = useAuthContext();

  const deleteImage = () => {
    AttachmentService.delete(uploadObj.key)
      .then((result) => {
        setUploadObj(uploadObjDefaults);
      })
      .catch((err) => {
        setUploadObj({
          response: `Can't delete file: ${err}`,
          ...uploadObj,
        });
      });
  };

  const resetState = () => {
    setText('');
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeChannelArn]);

  const onChange = (e) => {
    setText(e.target.value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    let sendMessageResponse;

    if (uploadRef.current.files[0]) {
      try {
        // We have file to upload
        const response = await AttachmentService.upload(
          uploadRef.current.files[0]
        );
        const options = {};

        setUploadObj({
          key: response.key,
          ...uploadObj,
        });

        options.Metadata = JSON.stringify({
          attachments: [
            {
              fileKey: response.key,
              name: uploadObj.name,
              size: uploadObj.file.size,
              type: uploadObj.file.type,
            },
          ],
        });
        sendMessageResponse = await sendChannelMessage(
          activeChannelArn,
          text || ' ',
          'PERSISTENT',
          member,
          options
        );
        // Cleanup upload refs
        setUploadObj(uploadObjDefaults);
        uploadRef.current.value = '';
      } catch (err) {
        setUploadObj({
          response: `Can't upload file: ${err}`,
          ...uploadObj,
        });
        throw new Error(`Failed uploading... ${err}`);
      }
    } else {
      sendMessageResponse = await sendChannelMessage(activeChannelArn, text, 'PERSISTENT', member);
    }
    resetState();
    if (sendMessageResponse.response.Status == 'PENDING') {
      const sentMessage = await getChannelMessage(activeChannelArn, member, sendMessageResponse.response.MessageId);
      const newMessages = [...messages, sentMessage];
      setMessages(newMessages);
    }
  };

  const onRemoveAttachmentHandler = (event) => {
    event.preventDefault();

    setUploadObj(uploadObjDefaults);
  };

  const uploadButton = <IconButton
      className="write-link attach"
      onClick={(_event) => {
        uploadRef.current.value = null;
        uploadRef.current.click();
      }}
      icon={<Attachment width="1.5rem" height="1.5rem" />}
  />;

  if (hasMembership) {
    return (
      <div className="message-input-container">
        <form onSubmit={onSubmit} className="message-input-form">
          <InputComponent
            onChange={onChange}
            value={text}
            type="text"
            placeholder="Type your message"
            autoFocus
            className="text-input"
            ref={inputRef}
          />
          {uploadObj.file ? (
            <div className="attachment-preview">
              <Attachment
                style={{ margin: 'auto 0' }}
                width="1.5rem"
                height="1.5rem"
              />
              <Label style={{ margin: 'auto 0' }}>{uploadObj?.name}</Label>
              <IconButton icon={<Remove width="1.5rem" height="1.5rem" />} />
            </div>
          ) : null}
        </form>
        {isAnonymous ? '\u00a0\u00a0' : uploadButton}
        <input
          type="file"
          accept="file_extension|audio/*|video/*|image/*|media_type"
          style={{ display: 'none' }}
          ref={uploadRef}
          onChange={(event) => {
            const file = event.currentTarget.files[0];
            if (!file) return;

            if (file.size / 1024 / 1024 < 5) {
              setUploadObj({
                file: file,
                name: file.name,
              });
            } else {
              notificationDispatch({
                type: 0,
                payload: {
                  message: `File (${file.name}) size (${formatBytes(
                    file.size
                  )}) Maximum supported file size is up to 5MB.`,
                  severity: 'error',
                },
              });
            }
          }}
        />
      </div>
    );
  }
  return (
    <div className="message-input-container join-channel-message">
      Join this channel to send messages.
    </div>
  );
};

export default Input;
