# Dark Web Onion Crawler

This project is a dark web crawler and search engine that fetches, extracts, and stores .onion links using Selenium (with Tor), Supabase, and Python. It also includes a React frontend for searching and managing links.

## Features
- Fetches .onion links from sources using a headless browser (Selenium + Firefox + Tor)
- Stores links in Supabase
- Filters out IRC, XMPP, Wikipedia, and fragment links
- Designed for crawling the dark web via Tor
- Modern React frontend with Tailwind CSS

## Quick Start

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd <your-repo-directory>
```

### 2. Install Python (Recommended: Use [pyenv](https://github.com/pyenv/pyenv))
- Ensure you have Python 3.11 or 3.10 installed (not 3.13).
- Install [pyenv](https://github.com/pyenv/pyenv) if needed.

### 3. Create and activate a virtual environment
```bash
python -m venv venv
source venv/bin/activate
```

### 4. Install dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Set up your `.env` file
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```

### 6. Install Firefox and geckodriver
- Make sure Firefox is installed.
- Install geckodriver (e.g., `sudo apt install firefox-esr` and `sudo apt install geckodriver` on Debian/Kali).

### 7. Start Tor
Make sure Tor is running and listening on port 9050:
```bash
sudo systemctl start tor
```

### 8. Run the crawler
```bash
python fetchlinks.py
```

### 9. Run the frontend (optional)
```bash
cd frontend
npm install
npm run dev
```

## Troubleshooting
- **Python 3.13 is not supported.** Use Python 3.11 or 3.10.
- If you get `ModuleNotFoundError`, ensure your venv is activated and dependencies are installed.
- For Selenium errors, ensure Firefox and geckodriver are installed and in your PATH.
- For Tor errors, ensure the Tor service is running on port 9050.
- For Supabase errors, check your `.env` credentials.

## Contributing
- Fork the repo and create a feature branch.
- Submit pull requests with clear descriptions.
- Please add tests for new features.

## License
MIT

# Python 3.11 Installation Guide with pyenv

Follow these steps to install Python 3.11 using pyenv:

1. **Install pyenv dependencies:**
   ```sh
   sudo apt update
   sudo apt install -y make build-essential libssl-dev zlib1g-dev \
     libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm \
     libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev
   ```

2. **Install pyenv:**
   ```sh
   curl https://pyenv.run | bash
   ```
   Add the following lines to your `~/.bashrc`, `~/.zshrc`, or `~/.profile`:
   ```sh
   export PATH="$HOME/.pyenv/bin:$PATH"
   eval "$(pyenv init --path)"
   eval "$(pyenv virtualenv-init -)"
   ```
   Then restart your shell or run:
   ```sh
   source ~/.zshrc  # or ~/.bashrc or ~/.profile
   ```

3. **Install Python 3.11:**
   ```sh
   pyenv install 3.11.9
   ```

4. **Set Python 3.11 as the local version:**
   ```sh
   pyenv local 3.11.9
   ```

5. **(Optional) Create a virtual environment:**
   ```sh
   python -m venv venv
   source venv/bin/activate
   ```

6. **Install dependencies:**
   ```sh
   pip install -r requirements.txt
   ```

You now have Python 3.11 set up with pyenv and your dependencies installed.
# DarkLens
