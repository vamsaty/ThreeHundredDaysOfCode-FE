import React, { useEffect, useState } from "react";
import CodeEditorWindow from "./CodeEditorWindow";
import axios from "axios";
import { languageOptions } from "../constants/languageOptions";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import useKeyPress from "../hooks/useKeyPress";
import LanguagesDropdown from "./LanguagesDropdown";
import ResultTab from './ResultTab';

// Style Components.
import { Avatar, Button, Card, Input, message } from 'antd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import styled from "styled-components";

// Cookies.
import Cookies from 'universal-cookie';

// Authentication.
import { Auth } from "aws-amplify";

// Utility.
const getUuid = require('uuid-by-string');

/**
 * For documentation on the Code-Editor use the following blog as a reference:
 * https://www.freecodecamp.org/news/how-to-build-react-based-code-editor/
 */

const javascriptDefault = `/**
* Problem: Binary Search: Search a sorted array for a target value.
*/

// Time: O(log n)
const binarySearch = (arr, target) => {
 return binarySearchHelper(arr, target, 0, arr.length - 1);
};

const binarySearchHelper = (arr, target, start, end) => {
 if (start > end) {
   return false;
 }
 let mid = Math.floor((start + end) / 2);
 if (arr[mid] === target) {
   return mid;
 }
 if (arr[mid] < target) {
   return binarySearchHelper(arr, target, mid + 1, end);
 }
 if (arr[mid] > target) {
   return binarySearchHelper(arr, target, start, mid - 1);
 }
};

const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const target = 5;
console.log(binarySearch(arr, target));
`;

const LandingContainer = styled.main`
  display: flex;
  flex-direction: column;
  margin-top: 48px;
  height: calc(100vh - 48px);
  margin-left: 0;
  width: 100%;
  border: 2px white solid;
`
const CodeEditorOuterContainer = styled.main`
  display: flex;
  padding-bottom: 1rem;
  padding-top: 1rem;
  padding-left: 1rem;
  padding-right: 1rem;
  align-items: flex-start;
  flex-direction: row;
`
const CodeEditorWindowInnerContainer = styled.main`
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  flex-direction: column;
  width: 100%;
  height: 100%;  
`
const StyledRunButton = styled((props) => <Button {...props} />)`  
  background-color: #1890ff!important;
  margin-left: 20px;
  height: 44px;
  border-radius: 0.5rem;
`
const StyledSubmitButton = styled((props) => <Button {...props} />)`
  background-color: #1890ff!important;
  margin-left: 20px;
  height: 44px;
  border-radius: 0.5rem;
`
const ButtonContainer = styled.main`
  padding-top: 0.5rem!important;
  padding-bottom: 0.5rem!important;
  padding-right: 1.5rem!important;
  padding-left: 1.5rem!important;
  display: flex;
  flex-direction: row;
`

// Common Library Methods.
const encode = (str) => {
  return btoa(unescape(encodeURIComponent(str || "")));
};
const decode = (bytes) => {
  var escaped = escape(atob(bytes || ""));
  try {
      return decodeURIComponent(escaped);
  } catch {
      return unescape(escaped);
  }
};
// ....... Library Methods.

// Common Methods for showing errors.
const showMessage = (success, error, warning) => {
  if (success !== null) {
      message.success({
      content: success,
      className: 'display-message',
    });
  } else if (error !== null) {
      message.error({
      content: error,
      className: 'display-message',
    });
  } else if (warning !== null) {
    message.warning({
    content: warning,
    className: 'display-message',
  });
}
}
// .........................


const Landing = (props) => {
  const [code, setCode] = useState(javascriptDefault);
  const [customInput, setCustomInput] = useState("");
  const [outputDetails, setOutputDetails] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [theme, setTheme] = useState("vs-dark");
  const [language, setLanguage] = useState(languageOptions[0]);
  const [userId, setUserId] = useState('');
  const [jwtToken, setJwtToken] = useState('');
  const [outputText, setOutputText] = useState('');
  const [inputText, setInputText] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [runButtonLoading, setRunButtonLoading] = useState(false);
  const [submitButtonLoading, setSubmitButtonLoading] = useState(false);

  const problemId = props.problemId || '';
  const apiUrl = process.env.REACT_APP_API_URL;

  const enterPress = useKeyPress("Enter");
  const ctrlPress = useKeyPress("Control");

  const onSelectChange = (sl) => {
    console.log("selected Option...", sl);
    setLanguage(sl);
  };
  
  // Setting user properties when the user lands on the page.
  // TODO(Ravi): This should be moved to a library method.
  async function getUserDetailsCognito() {  
    const currentSessionResponse = await Auth.currentSession();
    const accessToken = currentSessionResponse.getAccessToken();
    const jwtToken = accessToken.getJwtToken();
    setJwtToken(jwtToken);
  }
  async function getUserDetailsGoogleSSO(){
    const userAuth = await Auth.currentAuthenticatedUser();
    const requestOptions = { 'method': 'GET' };
    const userId = getUuid(userAuth.email);
    setUserId(userId);
  }
  const getUserDetails = () => {
    const cookies = new Cookies();
    const loginType = cookies.get('loginType');
    if (loginType === 'cognito') {
      getUserDetailsCognito();
    } else {
      getUserDetailsGoogleSSO();
    }
  };
  // .......  Setting User Details .......

  useEffect(() => {
    if (enterPress && ctrlPress) {
      console.log("enterPress", enterPress);
      console.log("ctrlPress", ctrlPress);
      handleCompile();
    }
    getUserDetails();
  }, [ctrlPress, enterPress]);

  const onChange = (action, data) => {
    switch (action) {
      case "code": {
        setCode(data);
        break;
      }
      default: {
        console.warn("case not handled!", action, data);
      }
    }
  };
  const handleCompile = () => {
    setProcessing(true);
    const formData = {
      language_id: language.id,
      // encode source code in base64
      source_code: btoa(code),
      stdin: btoa(customInput),
    };
    const options = {
      method: "POST",
      url: process.env.REACT_APP_RAPID_API_URL,
      params: { base64_encoded: "true", fields: "*" },
      headers: {
        "content-type": "application/json",
        "Content-Type": "application/json",
        "X-RapidAPI-Host": process.env.REACT_APP_RAPID_API_HOST,
        "X-RapidAPI-Key": process.env.REACT_APP_RAPID_API_KEY,
      },
      data: formData,
    };

    axios
      .request(options)
      .then(function (response) {
        console.log("res.data", response.data);
        const token = response.data.token;
        checkStatus(token);
      })
      .catch((err) => {
        let error = err.response ? err.response.data : err;
        // get error status
        let status = err.response.status;
        console.log("status", status);
        if (status === 429) {
          console.log("too many requests", status);

          showErrorToast(
            `Quota of 100 requests exceeded for the Day! Please read the blog on freeCodeCamp to learn how to setup your own RAPID API Judge0!`,
            10000
          );
        }
        setProcessing(false);
        console.log("catch block...", error);
      });
  };

  const checkStatus = async (token) => {
    const options = {
      method: "GET",
      url: process.env.REACT_APP_RAPID_API_URL + "/" + token,
      params: { base64_encoded: "true", fields: "*" },
      headers: {
        "X-RapidAPI-Host": process.env.REACT_APP_RAPID_API_HOST,
        "X-RapidAPI-Key": process.env.REACT_APP_RAPID_API_KEY,
      },
    };
    try {
      let response = await axios.request(options);
      let statusId = response.data.status?.id;

      // Processed - we have a result
      if (statusId === 1 || statusId === 2) {
        // still processing
        setTimeout(() => {
          checkStatus(token);
        }, 2000);
        return;
      } else {
        setProcessing(false);
        setOutputDetails(response.data);
        showSuccessToast(`Compiled Successfully!`);
        console.log("response.data", response.data);
        return;
      }
    } catch (err) {
      console.log("err", err);
      setProcessing(false);
      showErrorToast();
    }
  };
  const showSuccessToast = (msg) => {
    toast.success(msg || `Compiled Successfully!`, {
      position: "top-right",
      autoClose: 1000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };
  const showErrorToast = (msg, timer) => {
    toast.error(msg || `Something went wrong! Please try again.`, {
      position: "top-right",
      autoClose: timer ? timer : 1000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };
  const handleCodeRun = () => {  
    if (code.trim() === "") {        
        console.log('Source code cannot be empty.');
        return;
    } else {
        setRunButtonLoading(true);
    }
    setOutputText('');   
    const sourceValue = encode(code);
    const stdinValue = encode(inputText);
    const languageId = language.id;
    var data = {
        source_code: sourceValue,
        language_id: languageId,
        stdin: stdinValue,
        compiler_options: '',
        command_line_arguments: '',
        redirect_stderr_to_stdout: true,
        user_id: userId,
        problem_id: problemId
    };
    const handleCodeSubmission = (data) => {    
      var status = data.status;
      setStatusLine(status.description);
      setStatusMsg(status.description);      
      setRunButtonLoading(false);
    }
    const sendRequest = function(data) {
      const options = {
        method: "POST",
        url: process.env.REACT_APP_API_URL + "/submissions",
        params: { base64_encoded: "true", fields: "*" },        
      };
      axios
      .request(options)
      .then(function (response) {
        handleCodeSubmission(JSON.parse(response));
      })
      .catch((error) => {
        console.log(error)
      });
    }
  }
  return (
    <LandingContainer>
      <div className="flex flex-row">
        <ButtonContainer>
          <LanguagesDropdown onSelectChange={onSelectChange} />           
          <StyledRunButton 
            type="primary" 
            icon={<PlayArrowIcon />} 
            onClick={handleCodeRun}
            loading={runButtonLoading}
            >
            Run Code 
          </StyledRunButton>
          <StyledSubmitButton 
            type="primary" 
            icon={<PlayArrowIcon />} 
            loading={submitButtonLoading}
            > Evaluate Code </StyledSubmitButton>          
          </ButtonContainer>  
      </div>
      <CodeEditorOuterContainer>        
        <CodeEditorWindowInnerContainer>
          <CodeEditorWindow
            code={code}
            onChange={onChange}
            language={language?.value}
            theme={theme.value}
            
          />
        </CodeEditorWindowInnerContainer>
        <ResultTab />
      </CodeEditorOuterContainer>
    </LandingContainer>
  );
};
export default Landing;