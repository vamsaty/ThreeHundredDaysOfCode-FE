import { Auth } from 'aws-amplify';
import React, { createContext, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'universal-cookie';
import { getUuid } from '../../containers/Login';
import { onError } from '../errorLib';
import { defaultSessionInfo, SessionActions, SessionReducer } from './session-reducer';


const SessionStateContext = createContext(defaultSessionInfo)
const SessionDispatchContext = createContext(undefined)

/*
TODO (satyam.sundaram): Add to app context
<AppContext.Provider value={{
          isAuthenticated, userHasAuthenticated,
          filteredSuggestions, setFilteredSuggestions,
          activeSuggestion, setActiveSuggestion
        }}>
*/

function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
   var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
     return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
   }).join(''));
 
   return JSON.parse(jsonPayload);
 };


const SessionContextProvider = ({ children }) => {
    let navigate = useNavigate()
    const [state, dispatch] = useReducer(SessionReducer, defaultSessionInfo)

    const onLoad = async() => {
        try {
            dispatch({type: SessionActions.LOGIN_START})
            dispatch({type: SessionActions.IS_LOADING})
            const cookies = new Cookies();
            const state = {
                isAuthenticated: !!cookies.get('isLoggedIn'),
                sessionToken: cookies.get('jwtToken'),
                userId: cookies.get('userId'),
                loginType: cookies.get('loginType'),
                sessionId: '',  /* any todo */
                expiration: '',
            }
            dispatch({
                type: SessionActions.SESSION_SET,
                payload: state
            })
            dispatch({type: SessionActions.LOGIN_END})
            dispatch({type: SessionActions.DONE_LOADING})
        } catch (e) {
            if (e !== "No current user") {
                onError(e);
                dispatch({type: SessionActions.LOGIN_ERROR})
            }
        }
    }

    // Logout function
    const logout = async() => {
        try {
            dispatch({type: SessionActions.LOGOUT_START})
            dispatch({type: SessionActions.IS_LOADING})
            await Auth.signOut()
            const cookies = new Cookies();
            cookies.remove('isLoggedIn', { path: '/' });
            cookies.remove('jwtToken', { path: '/' });
            dispatch({type: SessionActions.LOGOUT_END})
            dispatch({type: SessionActions.DONE_LOADING})
            navigate("/");
        } catch (e) {
            onError(e)
            dispatch({type: SessionActions.LOGOUT_ERROR})
        }
    }

    // user/password login
    const basicLogin = async(user, password) => {
        try {
            dispatch({type: SessionActions.LOGIN_START})
            dispatch({type: SessionActions.IS_LOADING})
            const cognitoUser = await Auth.signIn(user, password)
            const jwtToken = cognitoUser.signInUserSession.accessToken.jwtToken;
            const userId = cognitoUser.signInUserSession.accessToken.payload.sub;
            const cookies = new Cookies();
            const expiresDate = new Date();
            expiresDate.setFullYear(new Date().getFullYear() + 1);
            cookies.set('isLoggedIn', true, { path: '/', expires: expiresDate });
            cookies.set('jwtToken', jwtToken, { path: '/', expires: expiresDate });
            cookies.set('loginType', 'cognito', { path: '/', expires: expiresDate });
            cookies.set('userId', userId, { path: '/', expires: expiresDate });
            dispatch({type: SessionActions.LOGIN_END})
            dispatch({type: SessionActions.DONE_LOADING})
            navigate("/home");
        } catch (e) {
            dispatch({type: SessionActions.LOGIN_ERROR})
            onError(e);
        }
    }

    // OAuth login
    const googleSSOLogin = async(response) => {
        try {
            dispatch({type: SessionActions.LOGIN_START})
            const jwtToken = response.credential;
            const payload = parseJwt(jwtToken);
            const idToken = jwtToken;
            const expiresAt = payload.exp;
            const user = {
                email: payload.email,
                name: payload.name
            };
            await Auth.federatedSignIn('google', { token: idToken, expiresAt }, user);
            const userId = getUuid(payload.email);
            const cookies = new Cookies();
            const expiresDate = new Date();
            expiresDate.setFullYear(new Date().getFullYear() + 1);
            cookies.set('isLoggedIn', 'true', { path: '/', expires: expiresDate });
            cookies.set('jwtToken', jwtToken, { path: '/', expires: expiresDate });
            cookies.set('loginType', 'googleSSO', { path: '/', expires: expiresDate });
            cookies.set('userId', userId, { path: '/', expires: expiresDate });
            // TODO (satyam.sundaram) : Add create User account with SSO
            // createUserAccountWithSSO(payload.email, payload.name);
            navigate('/');
            dispatch({type: SessionActions.LOGIN_END})
            dispatch({type: SessionActions.DONE_LOADING})
        } catch (e) {
            dispatch({type: SessionActions.LOGIN_ERROR})
            onError(e)
        }
    }

    return <SessionStateContext.Provider value={state}>
        <SessionDispatchContext.Provider value={{onLoad, basicLogin, googleSSOLogin, dispatch, logout}}>
            {children}
        </SessionDispatchContext.Provider>
    </SessionStateContext.Provider>
}


const useSessionStateContext = () => {
    const ctx = React.useContext(SessionStateContext)
    return ctx
}

const useSessionDispatchContext = () => {
    return React.useContext(SessionDispatchContext)
}

export {
    useSessionStateContext,
    useSessionDispatchContext,
    SessionContextProvider
}