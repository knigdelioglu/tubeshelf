import React from "react";
import {createRoot} from "react-dom/client";
import {App} from "./App";
import "./style.css";
import "./channels.css";
const el=document.getElementById("root");
if(!el)throw new Error("Root element missing");
createRoot(el).render(<React.StrictMode><App/></React.StrictMode>);
import "./center.css";
