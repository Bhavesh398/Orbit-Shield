import React from 'react';
import { useNavigate } from 'react-router-dom';

function Header() {
  const navigate = useNavigate();
  
  return (
    <div className="header">
      <h1 className="title">ORBIT SHIELD</h1>
      <div className="header-icons">
        <button className="icon-btn">☰</button>
      </div>
    </div>
  );
}

export default Header;
