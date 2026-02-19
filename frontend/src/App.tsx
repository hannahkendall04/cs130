import "./App.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useState } from 'react';

function App() {

  const [filterMethod, setFilterMethod] = useState("");

  // testing - constant time ranges 
  const startNum = 10;
  const endNum = 13;
  // end testing 

  // testing - constant time range on save
  const handleSave = () => {
    chrome.storage.local.set({
      skipRange: {
        start: startNum,
        end: endNum
      },
      filterMethod: filterMethod
    })
  }

  return (
    <div className="flex w-96 flex-col gap-4 p-4">
      <h1 className="w-full text-center">flixtra</h1>
      <div className="flex flex-col gap-2">
        <h2>display name</h2>
        <p>lorem ipsum</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2>pg-ify</h2>
          <Switch />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>profanity</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>sexual content</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>substance use</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox />
          <p>violence and abuse</p>
        </div>
        <div className="flex gap-2 flex-col">
          <h2>Filter method</h2>
          <div className="flex px-2 gap-2">
            <button id="skipButton" className="w-[50%] rounded bg-blue-500 text-white mb-2 hover:bg-blue-700" onClick={() => setFilterMethod("skip")}>skip</button>
            <button id="muteButton" className="w-[50%] rounded bg-blue-500 text-white mb-2 hover:bg-blue-700" onClick={() => setFilterMethod("mute")}>mute</button>
            <button id="muteButton" className="w-[50%] rounded bg-blue-500 text-white mb-2 hover:bg-blue-700" onClick={() => setFilterMethod("bleep")}>bleep</button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h2>show comments section</h2>
        <Switch />
      </div>
      <div className="flex items-center">
        <button id="saveButton" className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-700" onClick={handleSave}>save</button>
      </div>
    </div>
  );
}

export default App;
