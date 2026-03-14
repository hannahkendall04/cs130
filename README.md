# flixtra

A Chrome extension that provides extra features to Netflix using React and [Vite](https://vitejs.dev/) with TypeScript along with a FastAPI backend.

## Motivation/Overview

Many Netflix users want greater control over the type of content they watch and a more interactive viewing experience, especially when sharing accounts with children or watching casually with friends and family. Currently, viewers must rely on broad age ratings or manually skip scenes, which can be inconvenient and inconsistent. To achieve this goal, we created Flixtra, a Netflix browser extension that transforms Netflix into a safer, more social platform by allowing users to watch a “PG-ified” version of movies or shows that automatically skips, mutes, or bleeps mature scenes such as sexually explicit content, profanity, violence, drug use, or bullying. Some types of explicit content (like sexual content) are blurred as well. In addition, the extension introduces a social layer where users can leave comments on specific shows, view others’ reactions, and engage in discussions. 

## High-Level Design

Flixtra offers a variety of useful features that bring it to life:

1. **Content Filtering (PG-ify):** The flagship feature of Flixtra is the PG-ify mode, which automatically filters mature content during Netflix playback. Users can select from four different content categories, specifically, profanity, sexual content, substance use, violence/abuse, and/or bullying, and then choose how filtered content is handled: scenes can be skipped entirely, muted, or beeped over with a special sound effect. Additionally, when using mute or bleep mode, users can optionally enable a video blur alongside the audio filtering. When active, the video frame is blurred during flagged content ranges, providing a visual layer of filtering on top of the audio one. Compared to our Design Doc, we originally proposed that Flixtra would only run analysis if the show’s maturity rating matched the selected filters. We dropped this feature in favor of always analyzing content when the PG-ify option is enabled, which simplified the system and avoided relying on Netflix’s inconsistent rating metadata. Furthermore, blurring was not present in the Design Doc and was added during development to add to the overall user experience and PG-ify at both an audio and visual level.
2. **Instant Start with Smart Loading:** Nobody wants to wait! When you open an episode or movie that Flixtra hasn’t seen before, it analyzes the content in the background and shows a brief loading screen while it prepares your personalized viewing experience. The moment enough content has been processed, the video starts automatically, so users don’t have to wait for the entire episode or movie to be fully analyzed before they start watching. Once content has been analyzed with your selected filter settings, it instantly loads for the next time any user wants to watch that episode or movie with no wait times at all. This feature was not present in our Design Doc and was added to significantly improve the user experience around analysis time.
3. **Comment Section:** Flixtra injects a sidebar into the Netflix watch page that displays timestamped comments from other users. Comments become visible as playback reaches the moment they were posted at, creating a synchronized viewing discussion that feels alive. Users can post their own comments, too, where comments are identified by a display name that users can set in the extension popup window without account creation or passwords being required.
4. **Extension Popup and Preferences:** The extension popup lets users configure all of Flixtra’s settings: their display name, which filter categories are active, the filter method selected (skip/mute/bleep), and whether the comment sidebar is shown. Preferences are locked while actively watching an episode to prevent mid-episode changes from causing inconsistent behavior, communicated clearly in the UI. The popup also auto-opens when a user navigates to Netflix and can be dismissed for the rest of the browser session with a single click.

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

3. Install the backend dependencies:

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

Create an env file to store sensitive environment variables as `backend/.env`:
```env
MONGODB_URL="..."
DB_NAME="..."
GEMINI_API_KEY="..."
```

To start the backend development server (make sure your virtual environment is active!):

```sh
cd backend
uvicorn main:app --reload
```

This will start the Vite development server and open your default browser.

## Running Tests

### Frontend

Tests use Vitest and React Testing Library. To run all tests:

```sh
cd frontend
npm run test
```

### Backend

Unit tests currently live under `backend/app/filters` and use Python's built-in `unittest` runner. To run all backend filter tests:

- From `backend/`:

```sh
python -m unittest discover -s app/filters -p "test_*.py" -v
```

- From repo root:

```sh
python -m unittest discover -s backend/app/filters -p "test_*.py" -v
```

(Optional) Run a specific test file, class, or method.

```sh
python -m unittest app.filters.test_detector_unit -v
python -m unittest app.filters.test_detector_unit.TestDetectorHelpers -v
python -m unittest app.filters.test_detector_unit.TestDetectorHelpers.test_compile_patterns_word_boundaries -v
```

## License

This project is licensed under the MIT License.
