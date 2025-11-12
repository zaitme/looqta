# UI Design Documentation

## Overview

Looqta features a modern, high-fidelity user interface built with Next.js, React, and Tailwind CSS. The design focuses on user experience, real-time feedback, and visual appeal.

## Design System

### Color Palette
- **Primary**: Blue (#2563eb) to Indigo (#4f46e5) to Purple (#9333ea)
- **Success**: Green (#10b981) to Emerald (#059669)
- **Error**: Red (#ef4444) to Pink (#ec4899)
- **Warning**: Yellow (#f59e0b) to Amber (#f97316)
- **Neutral**: Gray scale (50-900)

### Typography
- **Headings**: Bold, large sizes (text-2xl to text-7xl)
- **Body**: Regular weight, readable sizes
- **Gradient Text**: Used for main headings (blue → indigo → purple)

### Spacing
- Consistent spacing scale (4px base unit)
- Generous padding for cards and sections
- Responsive margins and gaps

## Components

### 1. Hero Section

**Location**: `frontend/app/page.js` (lines 49-69)

**Features**:
- Gradient background (blue → indigo → purple)
- Background pattern overlay
- Badge with Saudi flag emoji
- Large, bold typography
- Responsive text sizes

**Design Elements**:
- Full-width gradient header
- Rounded bottom corners (rounded-b-3xl)
- Shadow effects (shadow-2xl)
- Text drop shadows for readability

### 2. Search Box

**Location**: `frontend/components/SearchBox.js`

**Features**:
- Large input field with search icon
- Gradient button (blue → indigo → purple)
- Loading spinner inside input
- Error display with icon
- Responsive layout (stacked on mobile)

**Design Elements**:
- Rounded corners (rounded-2xl)
- Shadow effects (shadow-md, hover:shadow-lg)
- Focus ring (ring-4 ring-blue-100)
- Hover scale effect on button
- Disabled state styling

### 3. Loading States

**Location**: `frontend/app/page.js` (lines 84-168)

**Features**:
- **Main Spinner**: Dual-ring spinner (20x20) with reverse animation
- **Scraper Status Cards**: Individual cards for each scraper
- **Status Indicators**: 
  - Running: Spinner with ping animation
  - Completed: Green checkmark circle
  - Error: Red X circle
  - Pending: Spinning border
- **Streaming Notifications**: Success notifications as results arrive

**Design Elements**:
- Glass-morphism effect (backdrop-blur)
- Animated status indicators
- Color-coded states
- Staggered animations (slideIn with delays)

### 4. Result Cards

**Location**: `frontend/components/ResultCard.js`

**Features**:
- **Product Images**: 
  - Fixed height (h-64) for consistency
  - Hover scale effect
  - Gradient fallback when image missing
  - Error handling with fallback display
- **Site Badges**: 
  - Top-right badge with icon and site name
  - Secondary badge below product title
  - Gradient backgrounds
  - Icons: 🛒 (Amazon), 🌙 (Noon)
- **Price Display**: 
  - Large, bold pricing
  - Currency prefix
  - "Best price available" badge
- **Action Button**: 
  - Gradient button (blue → indigo)
  - Hover scale effect
  - External link icon

**Design Elements**:
- White cards with shadows
- Hover lift effect (translate-y)
- Border-left accent (blue-500)
- Responsive grid layout
- Smooth transitions

### 5. Benefits Section

**Location**: `frontend/app/page.js` (lines 214-256)

**Features**:
- Three benefit cards in grid layout
- Large emoji icons in gradient circles
- Hover scale effects
- Responsive (1 col mobile, 3 cols desktop)

**Benefits**:
1. 💰 Save Money - Compare prices
2. ⚡ Fast Results - Real-time comparisons
3. 🛡️ Trusted Sources - Amazon & Noon

### 6. Demo Search Examples

**Location**: `frontend/app/page.js` (lines 259-285)

**Features**:
- Quick search buttons for popular products
- Hover effects with gradient backgrounds
- Arrow icons on hover
- One-click search functionality

**Products**: iPhone, Laptop, Headphones, Smart Watch, Camera, Tablet

## Animations

### Custom Animations

**Location**: `frontend/styles/globals.css`

**Animations**:
1. **fadeInUp**: Fade in with upward motion
2. **slideIn**: Slide in from left
3. **pulse-glow**: Pulsing glow effect
4. **spin**: Standard rotation

**Usage**:
- Cards: `animate-fadeInUp`
- Status indicators: `animate-slideIn` with delays
- Spinners: `animate-spin`
- Loading states: `animate-pulse-glow`

## Responsive Design

### Breakpoints
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md)
- **Desktop**: 1024px - 1280px (lg)
- **Large Desktop**: > 1280px (xl)

### Layout Adaptations
- **Search Box**: Stacks vertically on mobile
- **Result Grid**: 
  - Mobile: 1 column
  - Tablet: 2 columns
  - Desktop: 3 columns
  - Large Desktop: 4 columns
- **Benefits**: 1 column mobile, 3 columns desktop
- **Typography**: Scales down on mobile

## Accessibility

### Features
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus indicators
- Color contrast compliance
- Alt text for images

### Best Practices
- All interactive elements are keyboard accessible
- Focus states clearly visible
- Error messages are descriptive
- Loading states provide feedback

## Performance

### Optimizations
- CSS animations (GPU accelerated)
- Lazy loading for images
- Optimized re-renders (React hooks)
- Efficient state management
- Minimal JavaScript bundle

### Loading Strategy
- Critical CSS inlined
- Non-critical styles loaded async
- Images with fallback handling
- Progressive enhancement

## Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile Browsers**: Full support

## Component Structure

```
frontend/
├── app/
│   ├── page.js              # Main page with all sections
│   └── layout.js            # Root layout
├── components/
│   ├── SearchBox.js         # Search input with streaming
│   ├── ResultCard.js        # Product result card
│   └── Spinner.js           # Loading spinner
└── styles/
    └── globals.css          # Global styles and animations
```

## Design Tokens

### Shadows
- `shadow-sm`: Small shadow
- `shadow-md`: Medium shadow
- `shadow-lg`: Large shadow
- `shadow-xl`: Extra large shadow
- `shadow-2xl`: 2XL shadow

### Border Radius
- `rounded-lg`: 8px
- `rounded-xl`: 12px
- `rounded-2xl`: 16px
- `rounded-3xl`: 24px
- `rounded-full`: Full circle

### Transitions
- `transition-all`: All properties
- `duration-200`: 200ms
- `duration-300`: 300ms
- `duration-500`: 500ms

## Usage Examples

### Adding a New Component
```jsx
import Spinner from '../components/Spinner';

export default function MyComponent() {
  return (
    <div className="card animate-fadeInUp">
      <Spinner size="md" />
    </div>
  );
}
```

### Using Animations
```jsx
<div className="animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
  Content
</div>
```

### Creating a Card
```jsx
<div className="card hover:shadow-xl transition-all duration-300">
  Card content
</div>
```

## Recent Updates (2025-11-10)

- ✅ Enhanced hero section with gradient and patterns
- ✅ Improved search box with search icon and gradient button
- ✅ Added dual-ring spinner for loading states
- ✅ Enhanced scraper status cards with animations
- ✅ Improved result cards with larger images
- ✅ Added site badges with icons
- ✅ Enhanced benefits section with hover effects
- ✅ Improved demo search buttons
- ✅ Added custom animations (fadeInUp, slideIn, pulse-glow)
- ✅ Responsive grid layout for results

---

**Last Updated**: 2025-11-10
**Design Version**: 2.0
