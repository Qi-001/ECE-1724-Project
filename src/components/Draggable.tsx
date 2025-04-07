import React, { useState, useEffect, useRef, ReactNode } from 'react';

interface DraggableProps {
  x: number;
  y: number;
  onDragStart?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  disabled?: boolean;
  children: ReactNode;
}

export const Draggable: React.FC<DraggableProps> = ({
  x,
  y,
  onDragStart,
  onDragEnd,
  disabled = false,
  children
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x, y });
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const parentDimensionsRef = useRef({ width: 0, height: 0 });
  
  // Update position when props change
  useEffect(() => {
    if (!isDragging) {
      setPosition({ x, y });
    }
  }, [x, y, isDragging]);
  
  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    onDragStart?.();
    
    // Store initial mouse position
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY
    };
    
    // Get parent container dimensions for bounds checking
    if (elementRef.current && elementRef.current.parentElement) {
      const parentRect = elementRef.current.parentElement.getBoundingClientRect();
      parentDimensionsRef.current = {
        width: parentRect.width,
        height: parentRect.height
      };
    }
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Calculate new position as percentage of parent container
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    
    const parentWidth = parentDimensionsRef.current.width;
    const parentHeight = parentDimensionsRef.current.height;
    
    if (parentWidth === 0 || parentHeight === 0) return;
    
    // Convert pixel deltas to percentage of parent
    const deltaXPercent = deltaX / parentWidth;
    const deltaYPercent = deltaY / parentHeight;
    
    // Calculate new position in percentage units (0-1)
    let newX = position.x + deltaXPercent;
    let newY = position.y + deltaYPercent;
    
    // Clamp to parent bounds (with some margin)
    newX = Math.max(0, Math.min(0.95, newX));
    newY = Math.max(0, Math.min(0.95, newY));
    
    setPosition({ x: newX, y: newY });
    
    // Update start position for the next move event
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY
    };
  };
  
  const handleMouseUp = (e: MouseEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Clean up event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    setIsDragging(false);
    onDragEnd?.(position.x, position.y);
  };
  
  return (
    <div
      ref={elementRef}
      style={{
        position: 'absolute',
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
}; 