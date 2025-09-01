import {  Route, Routes } from "react-router-dom"
import AuthLayout from "./components/auth/layout.jsx"
import AuthLogin from "./pages/auth/login.jsx"
import AuthRegister from "./pages/auth/register.jsx"


function App() {
  
  return (
   <div className="flex flex-col overflow-hidden bg-white">
    
    <Routes>
      <Route path="/auth" element={<AuthLayout />} >
        <Route path="login" element={<AuthLogin />} />
        <Route path="register" element={<AuthRegister />} />

    </Route>
    </Routes>
   </div>
    
  )
}

export default App
