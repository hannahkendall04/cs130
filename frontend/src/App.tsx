import "./App.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

function App() {

  // testing - constant time ranges 
  const startNum = 10000;
  const endNum = 1000000;
  // end testing 

  // testing - constant time range on save
  const handleSave = () => {
    chrome.storage.local.set({
      skipRange: {
        start: startNum,
        end: endNum
      }
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
      </div>
      <div className="flex items-center justify-between">
        <h2>show comments section</h2>
        <Switch />
      </div>
      <div className="flex items-center">
        <button id="saveButton" className="w-full rounded bg-blue-500 px-4 py-2 text-white" onClick={handleSave}>save</button>
      </div>
    </div>
  );
}

export default App;
