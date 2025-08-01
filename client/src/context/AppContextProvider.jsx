import React, {useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from 'axios';
import { AppContext } from "./AppContext.jsx";

export const AppContextProvider = (props)=>{

    axios.defaults.withCredentials = true;
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const [isLoggedin, setIsLoggedin] = useState(false)
    const [userData, setUserData] = useState(false)

    const getAuthState = async () => {
    try {
        const { data } = await axios.get(backendUrl + '/api/auth/is-auth');
        if (data.success) {
        setIsLoggedin(true);
        getUserData();
        } else {
        setIsLoggedin(false);
        setUserData(null);
        }
    } catch (error) {
        // Only show error toast if it's not a 401 (Unauthorized)
        if (error.response?.status !== 401) {
        toast.error(error.message);
        }

        // Ensure logout state is reflected in the UI
        setIsLoggedin(false);
        setUserData(null);
    }
    };


    const getUserData = async() =>{
        try {
            const {data} = await axios.get(backendUrl + '/api/user/data')
            data.success ? setUserData(data.userData) : toast.error(data.message)
        } catch (error) {
            toast.error(error.message)
        }
    }

    useEffect(()=>{
        getAuthState();
    },[])

    const value = {
        backendUrl,
        isLoggedin, setIsLoggedin,
        userData, setUserData,
        getUserData
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}