import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import './App.css';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('recruitai_auth') === 'true';
  return isAuthenticated ? children : <Navigate to="/" replace />;
};

const App = () => {
  const isAuthenticated = localStorage.getItem('recruitai_auth') === 'true';
  
  // Redirect to dashboard if authenticated, otherwise to login
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
};

export default App;
