# flixtra

A Chrome extension that provides extra features to Netflix using React and [Vite](https://vitejs.dev/) with TypeScript along with a FastAPI backend.

## Getting Started

### Prerequisites

- Make sure you have [Node.js](https://nodejs.org/) (version 18+ or 20+) installed on your machine.
- Also have at least version 3.11.9 of [Python](https://www.python.org/downloads/) downloaded!

### Setup

1. Clone or fork the repository :

   ```sh
   # To clone
   git clone https://github.com/hannahkendall04/cs130
   cd cs130
   ```

2. Install the frontend dependencies:

   ```sh
   cd frontend
   npm install
   ```

2. Install the backend dependencies:

   ```sh
   cd ..
   cd backend
   ```

   - If you're running Mac/Linux:
   ```sh
   source .venv/bin/activate
   ```

   - If you're running Windows with PowerShell:
   ```sh
   .venv\Scripts\Activate.ps1
   ```

   - Then proceed with the installation:
   ```sh
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

   Be sure to always have the virtual environment activated whenever working on the backend server! Learn more about using virtual environments [here](https://fastapi.tiangolo.com/virtual-environments/).

   To deactivate the virtual environment whenever you're done developing the backend server:
   ```sh
   deactivate
   ```

## Frontend Development

To start the development server:

```sh
cd frontend
npm run dev
```

This will start the Vite development server and open your default browser.

## 📦 Frontend Build

To create a production build:

```sh
cd frontend
npm run build
```

This will generate the build files in the `build` directory.

## 📂 Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable "Developer mode" using the toggle switch in the top right corner.
3. Click "Load unpacked" and select the `build` directory.

Your React app should now be loaded as a Chrome extension!

## 🗂️ Frontend Structure

- `frontend/public/`: Contains static files and the `manifest.json`.
- `frontend/src/`: Contains the React app source code.
- `frontend/vite.config.ts`: Vite configuration file.
- `frontend/tsconfig.json`: TypeScript configuration file.
- `frontend/package.json`: Contains the project dependencies and scripts.

## Backend Development

To start the backend development server (make sure your virtual environment is active!):

```sh
cd backend
fastapi dev app.py
```

This will start the Vite development server and open your default browser.

## License

This project is licensed under the MIT License.
