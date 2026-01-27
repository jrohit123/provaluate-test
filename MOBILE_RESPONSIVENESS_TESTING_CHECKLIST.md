# Mobile Responsiveness & Usability Testing Checklist

## 📱 Testing Environment Setup
- [ ] Test on actual mobile devices (iOS Safari, Android Chrome)
- [ ] Test on tablet devices (iPad, Android tablets)
- [ ] Use browser DevTools responsive mode:
  - iPhone SE (375px)
  - iPhone 12/13 (390px)
  - iPhone 14 Pro Max (430px)
  - iPad (768px)
  - Desktop (1024px+)

---

## 1. Header Component Testing

### Mobile View (< 768px)
- [ ] **Greeting Truncation**: 
  - Log in with a user that has a long name/company
  - Verify greeting truncates to ~30 chars with "..." on very small screens
  - Verify full greeting shows on medium screens (md breakpoint)
  - Hover/tap should show full text in tooltip (if implemented)

- [ ] **Logout Button**:
  - Verify button is at least 44px tall (touch-friendly)
  - Verify button is easily tappable on mobile
  - Verify button doesn't overlap with greeting text
  - Test logout functionality works correctly

- [ ] **SidebarTrigger**:
  - Verify trigger button is visible and accessible
  - Verify button is at least 44px × 44px on mobile
  - Test that tapping opens/closes sidebar

### Desktop View (≥ 768px)
- [ ] Full greeting displays without truncation
- [ ] All elements properly spaced and aligned

---

## 2. Dashboard Layout & Scrolling

### Mobile View
- [ ] **Main Content Scrolling**:
  - Navigate to a section with long content (e.g., Match Scorecard with many candidates)
  - Verify main content scrolls smoothly
  - Verify no horizontal scrolling unless intentional (tables)
  - Verify content is not clipped at bottom

- [ ] **Footer Behavior**:
  - Scroll to bottom of page
  - Verify footer appears after content (not fixed at viewport bottom)
  - Verify footer scrolls with content
  - Verify footer links are tappable and don't overlap

### Desktop View
- [ ] Layout maintains proper structure
- [ ] Footer appears at bottom when content is short
- [ ] Footer scrolls naturally with long content

---

## 3. Sidebar Mobile Behavior

### Mobile View (< 768px)
- [ ] **Sidebar as Sheet**:
  - Verify sidebar appears as a Sheet/Modal on mobile
  - Verify Sheet slides in from left side
  - Verify overlay appears behind Sheet

- [ ] **Navigation Closes Sheet**:
  - Open sidebar (tap SidebarTrigger)
  - Tap any navigation item (e.g., "Main Dashboard", "Job Upload", "Evaluation Criteria")
  - **CRITICAL**: Verify Sheet closes automatically after navigation
  - Test with all navigation items:
    - Main Dashboard
    - CV Screening items (Job Upload, Evaluation Criteria, Resume Upload, View All Results)
    - Interview Management items (Interview Creation, Send Interview, Interview Dashboard)
    - Settings (if admin)

- [ ] **SidebarTrigger Visibility**:
  - Verify trigger is always visible in Header
  - Verify trigger is easy to tap (44px minimum)
  - Verify trigger icon is clear and recognizable

- [ ] **No Focus Traps**:
  - Open sidebar on mobile
  - Verify you can interact with content
  - Verify you can close by tapping overlay
  - Verify keyboard navigation works (if applicable)

### Desktop View
- [ ] Sidebar behaves as normal sidebar (not Sheet)
- [ ] Sidebar can be collapsed/expanded
- [ ] Navigation works without closing sidebar

---

## 4. MatchScorecardSection Filters

### Mobile View
- [ ] **Filter Layout**:
  - Navigate to "View All Results" section
  - Verify filters are in a responsive grid layout
  - Verify filters stack vertically on mobile
  - Verify filters are in 2 columns on tablet/desktop

- [ ] **Job Description Select**:
  - Verify select is full-width on mobile
  - Verify select is at least 44px tall (h-11)
  - Verify label "Job Description" is clear
  - Test selecting a job description

- [ ] **Evaluation Criteria Select**:
  - Verify select is full-width on mobile
  - Verify select is at least 44px tall
  - Verify label "Evaluation Criteria" is clear
  - Test selecting criteria

- [ ] **Filter Dropdown**:
  - Verify filter dropdown is full-width on mobile
  - Verify touch target is adequate
  - Test filtering by recommendation status

- [ ] **Sort Button**:
  - Verify button is full-width on mobile
  - Verify button shows "Sort High→Low" or "Sort Low→High"
  - Test sorting functionality

- [ ] **Export Button**:
  - Verify button is full-width on mobile
  - Verify button text is clear
  - Test export functionality

### Desktop View
- [ ] Filters display in horizontal layout
- [ ] Selects have appropriate widths (not full-width)
- [ ] Buttons are auto-width

---

## 5. EvaluationCriteriaSection Mobile Layout

### Mobile View (< 768px)
- [ ] **Card-Based Layout**:
  - Navigate to "Evaluation Criteria" section
  - Verify criteria items display as cards (not table)
  - Verify each card shows:
    - Parameter To Assess (with label)
    - Weightage (with label and %)
    - How To Assess? (with label)
    - Delete button

- [ ] **Touch Targets**:
  - Verify all inputs are at least 44px tall (h-10)
  - Verify delete button is at least 44px × 44px
  - Verify "Add Parameter" button is full-width and 44px tall

- [ ] **Select Dropdown**:
  - Verify "Select saved criteria" dropdown is full-width
  - Verify dropdown is 44px tall
  - Test selecting a saved criteria

- [ ] **Save Form**:
  - Verify "Name your criteria" input is full-width
  - Verify "Save Criteria" button is full-width
  - Verify both are 44px tall
  - Test saving new criteria

- [ ] **Upload Area**:
  - Verify upload area has adequate padding
  - Verify "Tap to browse or drag & drop" hint is visible
  - Test file upload functionality

- [ ] **Total Weightage Display**:
  - Verify displays correctly on mobile
  - Verify validation message is readable

### Desktop View (≥ 768px)
- [ ] Table layout displays (not cards)
- [ ] All elements properly sized for desktop
- [ ] Table has horizontal scroll with "Swipe to scroll" hint (if needed)

---

## 6. Tables with Swipe Hints

### Mobile View
- [ ] **EvaluationCriteriaSection Table**:
  - On desktop view (≥ 768px), verify table displays
  - If table requires horizontal scroll, verify "← Swipe to scroll →" hint appears
  - Verify hint is positioned correctly (top-right)
  - Verify hint is only visible on mobile/tablet

- [ ] **AdminUserManagement Table**:
  - Navigate to Settings (as admin)
  - Verify users table displays
  - Verify "← Swipe to scroll →" hint appears on mobile
  - Test horizontal scrolling works
  - Verify hint disappears on desktop

### Desktop View
- [ ] Hints are hidden
- [ ] Tables display normally without hints

---

## 7. Footer Testing

### Mobile View
- [ ] **Layout**:
  - Verify footer links stack vertically
  - Verify no text overlap
  - Verify proper spacing between links
  - Verify all links are tappable

- [ ] **Scrolling Behavior**:
  - Scroll through long content
  - Verify footer appears at bottom of content (not fixed)
  - Verify footer scrolls with page
  - Verify footer is not cut off

- [ ] **Links**:
  - Test Privacy Policy link
  - Test Terms link
  - Test Contact link (email)
  - Test "Powered by aitamate" link

### Desktop View
- [ ] Footer links display horizontally
- [ ] Proper spacing with "|" separators
- [ ] Footer appears at bottom when content is short

---

## 8. Toast Notifications

### Mobile View (< 768px)
- [ ] **Position**:
  - Trigger a toast notification (e.g., save criteria, upload file)
  - Verify toast appears at **top-center** (not top-right)
  - Verify toast doesn't overlap with notch/status bar
  - Verify toast is readable

- [ ] **Size**:
  - Verify toast max-width is 90% of screen
  - Verify toast doesn't extend beyond screen edges
  - Verify text is readable

- [ ] **Functionality**:
  - Test success toasts
  - Test error toasts
  - Verify toasts auto-dismiss after 4 seconds
  - Verify toasts can be manually dismissed

### Desktop View (≥ 768px)
- [ ] Toast appears at **top-right**
- [ ] Toast max-width is 400px
- [ ] Toast displays normally

---

## 9. Modal/Dialog Responsiveness

### Mobile View
- [ ] **SessionTimeoutDialog**:
  - Wait for session timeout warning (or trigger manually)
  - Verify dialog is responsive:
    - Max-width doesn't exceed screen
    - Padding is appropriate (p-4 on mobile)
    - Content is scrollable if needed (max-h-[90vh])
    - Buttons are 44px tall minimum
    - Buttons stack vertically on mobile
  - Test "Continue Session" button
  - Test "Logout Now" button

- [ ] **SessionConflictDialog**:
  - Trigger session conflict (login from another device)
  - Verify dialog is responsive:
    - Proper margins (mx-4)
    - Scrollable content if needed
    - Buttons are touch-friendly (44px)
    - Buttons stack vertically
  - Test "Keep Existing Session" button
  - Test "Login Here (Logout Other)" button

- [ ] **General Dialog Behavior**:
  - Verify all dialogs have:
    - Responsive padding (p-4 sm:p-6)
    - Max height with scroll (max-h-[90vh] overflow-y-auto)
    - Mobile margins (mx-4)
    - Touch-friendly buttons

### Desktop View
- [ ] Dialogs display normally
- [ ] Buttons display horizontally
- [ ] Proper spacing and padding

---

## 10. Design Principles & Usability

### Language & Labels
- [ ] **Simplified Language**:
  - Verify "Select saved criteria" instead of "Select saved grid"
  - Verify "Name your criteria" with helpful placeholder
  - Verify "Save Criteria" instead of "Save as New"
  - Verify clear labels on all form fields

- [ ] **Wayfinding**:
  - Verify page titles are clear
  - Verify section headers are descriptive
  - Verify navigation items have clear labels
  - Verify buttons have clear, action-oriented text

- [ ] **Visual Hierarchy**:
  - Verify primary actions are prominent (large buttons)
  - Verify secondary actions are visually secondary
  - Verify supporting text is smaller but readable
  - Verify icons have labels (not icons alone)

### Consistency
- [ ] **Button Patterns**:
  - Verify "Next" / "Back" buttons are consistent
  - Verify "Save" buttons are consistent
  - Verify "Cancel" buttons are consistent

- [ ] **Navigation**:
  - Verify sidebar navigation is consistent
  - Verify breadcrumbs/step indicators (if any) are consistent
  - Verify "Go to X" links follow same pattern

---

## 11. Cross-Browser Testing

### Mobile Browsers
- [ ] **iOS Safari**:
  - Test on iPhone (various models)
  - Verify all features work
  - Verify no iOS-specific issues

- [ ] **Android Chrome**:
  - Test on Android devices
  - Verify all features work
  - Verify no Android-specific issues

- [ ] **Other Mobile Browsers**:
  - Test on Firefox Mobile
  - Test on Samsung Internet (if applicable)

### Desktop Browsers
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## 12. Performance Testing

### Mobile Performance
- [ ] **Load Times**:
  - Verify pages load quickly on mobile
  - Verify images are optimized
  - Verify no layout shift (CLS)

- [ ] **Scrolling Performance**:
  - Verify smooth scrolling on mobile
  - Verify no janky animations
  - Verify Sheet animations are smooth

- [ ] **Touch Responsiveness**:
  - Verify buttons respond immediately to touch
  - Verify no lag when tapping
  - Verify no accidental double-taps

---

## 13. Edge Cases

### Very Small Screens (< 375px)
- [ ] Verify all content is accessible
- [ ] Verify no horizontal scrolling (except intentional tables)
- [ ] Verify text is readable
- [ ] Verify buttons are tappable

### Landscape Orientation
- [ ] Test in landscape mode on mobile
- [ ] Verify layout adapts appropriately
- [ ] Verify no content is cut off

### Long Content
- [ ] Test with very long job descriptions
- [ ] Test with many candidates
- [ ] Test with many criteria items
- [ ] Verify scrolling works correctly

### Empty States
- [ ] Test with no saved criteria
- [ ] Test with no job descriptions
- [ ] Test with no candidates
- [ ] Verify empty states are clear and helpful

---

## 14. Accessibility Testing

### Mobile Accessibility
- [ ] **Screen Readers**:
  - Test with VoiceOver (iOS) or TalkBack (Android)
  - Verify all interactive elements are announced
  - Verify labels are descriptive

- [ ] **Touch Targets**:
  - Verify all interactive elements are at least 44px × 44px
  - Verify adequate spacing between touch targets
  - Verify no accidental taps

- [ ] **Color Contrast**:
  - Verify text is readable
  - Verify buttons have sufficient contrast
  - Verify links are distinguishable

- [ ] **Focus Indicators**:
  - Verify focus is visible (if keyboard navigation is used)
  - Verify focus order is logical

---

## 15. Regression Testing

### Existing Features
- [ ] Verify all existing functionality still works
- [ ] Verify no broken features
- [ ] Verify data persistence works
- [ ] Verify API calls work correctly

### Desktop Experience
- [ ] Verify desktop experience is not degraded
- [ ] Verify all desktop features work
- [ ] Verify layout is appropriate for desktop

---

## 🐛 Bug Reporting Template

If you find issues, document them with:

1. **Device/Browser**: e.g., "iPhone 13, iOS Safari 16.0"
2. **Screen Size**: e.g., "390px × 844px"
3. **Feature**: e.g., "Sidebar mobile navigation"
4. **Steps to Reproduce**: 
   - Step 1: ...
   - Step 2: ...
5. **Expected Behavior**: What should happen
6. **Actual Behavior**: What actually happens
7. **Screenshots**: If applicable

---

## ✅ Sign-Off Checklist

- [ ] All mobile features tested and working
- [ ] All desktop features tested and working
- [ ] No critical bugs found
- [ ] Performance is acceptable
- [ ] Accessibility requirements met
- [ ] Ready for production

---

## 📝 Notes

- Test on actual devices when possible (not just DevTools)
- Test with real data when possible
- Test with different user roles (admin, regular user)
- Test with slow network connections
- Test with different screen sizes and orientations
