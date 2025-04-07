'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { CalendarIcon, Clock } from "lucide-react";

interface EventFormProps {
  groupId?: string;
  userId: string;
  onSuccess?: (eventId: string) => void;
}

export default function EventForm({ groupId, userId, onSuccess }: EventFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [showReminderOptions, setShowReminderOptions] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    recurrenceType: 'none',
    recurrenceCount: '2',
    useDefaultReminders: true,
    emailReminderMinutes: '1440', // 24 hours
    popupReminderMinutes: '10'
  });

  // Fetch potential attendees if in a group
  useEffect(() => {
    if (groupId) {
      const fetchGroupMembers = async () => {
        try {
          const response = await fetch(`/api/groups/${groupId}/members`);
          if (response.ok) {
            const data = await response.json();
            setAttendees(data.members);
          }
        } catch (error) {
          console.error('Error fetching group members:', error);
        }
      };
      
      fetchGroupMembers();
    }
  }, [groupId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAttendeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const attendeeId = e.target.value;
    setSelectedAttendees(prev => 
      e.target.checked 
        ? [...prev, attendeeId] 
        : prev.filter(id => id !== attendeeId)
    );
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Combine date and time for start and end
      const startTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endTime = new Date(`${formData.endDate}T${formData.endTime}`);
      
      // Validate dates
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Invalid date or time format');
      }
      
      if (startTime >= endTime) {
        throw new Error('End time must be after start time');
      }
      
      // Create recurrence rule if enabled
      let recurrence: string[] | undefined;
      if (formData.recurrenceType !== 'none') {
        let rrule = `RRULE:FREQ=${formData.recurrenceType.toUpperCase()};COUNT=${formData.recurrenceCount}`;
        recurrence = [rrule];
      }
      
      // Configure reminders
      let reminders;
      if (!formData.useDefaultReminders) {
        const overrides = [];
        
        // Only add if values are valid
        if (formData.emailReminderMinutes && parseInt(formData.emailReminderMinutes) > 0) {
          overrides.push({
            method: 'email',
            minutes: parseInt(formData.emailReminderMinutes)
          });
        }
        
        if (formData.popupReminderMinutes && parseInt(formData.popupReminderMinutes) > 0) {
          overrides.push({
            method: 'popup',
            minutes: parseInt(formData.popupReminderMinutes)
          });
        }
        
        reminders = {
          useDefault: false,
          overrides: overrides.length > 0 ? overrides : undefined
        };
      } else {
        reminders = { useDefault: true };
      }
      
      console.log('Creating event with data:', {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        groupId,
        attendeeIds: selectedAttendees,
        recurrence,
        reminders
      });
      
      // Make API call to create event
      const response = await fetch('/api/calendar/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          location: formData.location,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          groupId,
          attendeeIds: selectedAttendees,
          recurrence,
          reminders
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create event');
      }
      
      console.log('Event created successfully:', data);
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        location: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        recurrenceType: 'none',
        recurrenceCount: '2',
        useDefaultReminders: true,
        emailReminderMinutes: '1440',
        popupReminderMinutes: '10'
      });
      setSelectedAttendees([]);
      
      // Call success callback if provided
      if (onSuccess && data.event?.id) {
        onSuccess(data.event.id);
      } else {
        // Redirect to calendar or events page
        router.push(groupId ? `/groups/${groupId}/events` : '/calendar');
        router.refresh();
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get today's date in YYYY-MM-DD format for min date values
  const today = new Date().toISOString().split('T')[0];

  return (
    <Card className="max-w-2xl mx-auto w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {groupId ? 'Create Group Event' : 'Create Calendar Event'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/15 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <FormLabel htmlFor="title">Event Title</FormLabel>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Add title"
                required
                className="w-full"
              />
            </div>
            
            <div className="grid gap-2">
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Add description (optional)"
                className="w-full min-h-[100px]"
              />
            </div>
            
            <div className="grid gap-2">
              <FormLabel htmlFor="location">Location</FormLabel>
              <Input
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Add location (optional)"
                className="w-full"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormLabel htmlFor="startDate">Start Date</FormLabel>
                <div className="flex">
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    min={today}
                    required
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="startTime">Start Time</FormLabel>
                <div className="flex">
                  <Input
                    id="startTime"
                    name="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="endDate">End Date</FormLabel>
                <div className="flex">
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    min={formData.startDate || today}
                    required
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <FormLabel htmlFor="endTime">End Time</FormLabel>
                <div className="flex">
                  <Input
                    id="endTime"
                    name="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel htmlFor="recurrenceToggle">Recurring Event</FormLabel>
                <Switch
                  id="recurrenceToggle"
                  checked={showRecurrenceOptions}
                  onCheckedChange={setShowRecurrenceOptions}
                />
              </div>
              
              {showRecurrenceOptions && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 border rounded-md bg-secondary/30">
                  <div className="space-y-2">
                    <FormLabel htmlFor="recurrenceType">Repeat</FormLabel>
                    <Select 
                      value={formData.recurrenceType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, recurrenceType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Don't repeat</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.recurrenceType !== 'none' && (
                    <div className="space-y-2">
                      <FormLabel htmlFor="recurrenceCount">Number of occurrences</FormLabel>
                      <Input
                        id="recurrenceCount"
                        name="recurrenceCount"
                        type="number"
                        min="2"
                        max="52"
                        value={formData.recurrenceCount}
                        onChange={handleInputChange}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {groupId && attendees.length > 0 && (
              <div className="space-y-2">
                <FormLabel>Attendees</FormLabel>
                <div className="grid gap-2 p-4 border rounded-md">
                  {attendees.map((attendee) => (
                    <div key={attendee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`attendee-${attendee.id}`}
                        value={attendee.id}
                        checked={selectedAttendees.includes(attendee.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAttendees(prev => [...prev, attendee.id]);
                          } else {
                            setSelectedAttendees(prev => prev.filter(id => id !== attendee.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`attendee-${attendee.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {attendee.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel htmlFor="reminderToggle">Custom Reminders</FormLabel>
                <Switch
                  id="reminderToggle"
                  checked={showReminderOptions}
                  onCheckedChange={(checked) => {
                    setShowReminderOptions(checked);
                    setFormData(prev => ({ ...prev, useDefaultReminders: !checked }));
                  }}
                />
              </div>
              
              {showReminderOptions && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 border rounded-md bg-secondary/30">
                  <div className="space-y-2">
                    <FormLabel htmlFor="emailReminderMinutes">Email Reminder (minutes before)</FormLabel>
                    <Input
                      id="emailReminderMinutes"
                      name="emailReminderMinutes"
                      type="number"
                      min="1"
                      value={formData.emailReminderMinutes}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <FormLabel htmlFor="popupReminderMinutes">Popup Reminder (minutes before)</FormLabel>
                    <Input
                      id="popupReminderMinutes"
                      name="popupReminderMinutes"
                      type="number"
                      min="1"
                      value={formData.popupReminderMinutes}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <CardFooter className="flex justify-end gap-2 px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Event'}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
} 