# JSON Comparator

A powerful, feature-rich web application for comparing JSON objects and visualizing differences with an intuitive interface. Built with React and styled with a modern dark theme.

## 🚀 Features

### Core Functionality
- **Side-by-side JSON comparison** with detailed difference analysis
- **Real-time JSON validation** with error highlighting
- **Visual difference categorization**: Added, Removed, Modified
- **Deep object and array comparison** with nested path tracking

### User Experience
- **Drag & drop JSON file support** (.json files)
- **File upload functionality** with validation
- **Sample data loading** for quick testing
- **JSON formatting and minification** tools
- **Swap functionality** to quickly switch JSON positions
- **Copy to clipboard** for JSON content and results

### Advanced Features
- **Search and filter results** by path or change type
- **Statistics dashboard** showing comparison overview
- **Responsive design** with mobile-friendly interface
- **Dark theme** with purple and slate color scheme

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/json-comparator.git
   cd json-comparator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

## 📖 Usage

### Basic Comparison
1. **Input JSON**: Paste JSON content into the left and right text areas, or drag & drop `.json` files
2. **Validate**: The app automatically validates JSON syntax and shows validation status
3. **Compare**: Click the "Compare" button to analyze differences
4. **Review Results**: View categorized differences with detailed change information

### Advanced Features
- **Load Sample Data**: Use the "Load Sample" button to see the tool in action
- **Format JSON**: Use the "Format" button to prettify your JSON
- **Minify/Expand**: Toggle between minified and formatted views
- **Swap JSONs**: Quickly switch left and right JSON content
- **Search Results**: Filter comparison results by path name
- **Filter by Type**: Show only Added, Removed, or Modified changes
- **Export Results**: Download comparison results as JSON or text reports

### File Support
- Drag and drop `.json` files directly onto the input areas
- Click "Upload" to browse and select JSON files
- Automatic file validation and error handling

## 🏗️ Technology Stack

- **Frontend Framework**: React 19.2.0
- **Icons**: Lucide React
- **Styling**: CSS-in-JS with Tailwind-like utilities
- **Build Tool**: Create React App
- **Testing**: React Testing Library & Jest

## 📦 Dependencies

```json
{
  "dependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^13.5.0",
    "lucide-react": "^0.545.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-scripts": "5.0.1",
    "web-vitals": "^2.1.4"
  }
}
```

## 🔧 Available Scripts

In the project directory, you can run:

### `npm start`
Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.
The page will reload when you make changes, and you'll see any lint errors in the console.

### `npm test`
Launches the test runner in interactive watch mode.

### `npm run build`
Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run eject`
**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time.

## 📊 Comparison Algorithm

The JSON comparator uses a recursive deep comparison algorithm that:

1. **Traverses nested objects** and arrays to identify all differences
2. **Tracks path information** for each change (e.g., `user.address.city`)
3. **Categorizes changes** into three types:
   - **Added**: Properties that exist in the second JSON but not the first
   - **Removed**: Properties that exist in the first JSON but not the second
   - **Modified**: Properties that exist in both but have different values
4. **Handles complex data types** including nested objects, arrays, and primitive values

## 🎨 UI/UX Features

- **Modern Dark Theme**: Sleek purple and slate color scheme
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Visual Feedback**: Real-time validation, loading states, and success indicators
- **Accessibility**: Proper color contrast, keyboard navigation, and screen reader support
- **Intuitive Icons**: Clear visual representation using Lucide React icons

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Issues & Support

If you encounter any issues or have questions, please [create an issue](https://github.com/your-username/json-comparator/issues) on GitHub.

## 🚀 Deployment

To deploy this application:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy the `build` folder** to your preferred hosting service:
   - Netlify
   - Vercel
   - GitHub Pages
   - AWS S3
   - Any static hosting provider

For detailed deployment instructions, see the [Create React App deployment documentation](https://facebook.github.io/create-react-app/docs/deployment).
