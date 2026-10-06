"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Calendar, Clock, User, Mail, Phone, BookOpen, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"

interface VolunteerFormProps {
  eventId: number
  eventTitle: string
  eventDate: Date
  volunteerRoles: string[]
}

export function VolunteerForm({ eventId, eventTitle, eventDate, volunteerRoles }: VolunteerFormProps) {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    rollNumber: user?.roll_number || "",
    role: volunteerRoles.length > 0 ? volunteerRoles[0] : "",
    skills: "",
    availability: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to volunteer for this event.",
          variant: "destructive",
        })
        return
      }

      // Register as volunteer
      const { error } = await supabase.from("registrations").insert([
        {
          event_id: eventId,
          user_id: user.id,
          is_volunteer: true,
          volunteer_role: formData.role,
        },
      ])

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation
          toast({
            title: "Already registered",
            description: "You have already registered for this event.",
            variant: "destructive",
          })
        } else {
          throw error
        }
        return
      }

      // Send confirmation email
      const { data: sess } = await supabase.auth.getSession()
      if (sess.session) {
        // Best-effort; server sends only to the signed-in user's own address.
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session.access_token}` },
          body: JSON.stringify({ type: "volunteer", eventId, role: formData.role }),
        }).catch(() => {})
      }

      setIsSuccess(true)
      toast({
        title: "Application submitted",
        description: "Your volunteer application has been submitted successfully!",
      })
    } catch (error) {
      console.error("Error submitting volunteer application:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Application Submitted!</CardTitle>
            <CardDescription>Thank you for volunteering for {eventTitle}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">
              Your application has been received and is being reviewed by the event organizers. You will receive an
              email notification once your application has been processed.
            </p>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {eventDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="mx-1">•</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {eventDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "numeric",
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardHeader>
          <CardTitle>Volunteer for this Event</CardTitle>
          <CardDescription>Help make this event a success by joining our volunteer team</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="volunteer-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="volunteer-name"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="volunteer-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="volunteer-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="volunteer-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="volunteer-phone"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter your phone number"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="volunteer-roll">Roll Number (if applicable)</Label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="volunteer-roll"
                  name="rollNumber"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                  placeholder="Enter your roll number"
                  className="pl-9"
                />
              </div>
            </div>

            {volunteerRoles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="volunteer-role">Volunteer Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger id="volunteer-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {volunteerRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="volunteer-skills">Skills & Experience</Label>
              <Textarea
                id="volunteer-skills"
                name="skills"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="Describe your skills and any relevant experience"
                className="min-h-[100px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="volunteer-availability">Availability</Label>
              <Textarea
                id="volunteer-availability"
                name="availability"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                placeholder="Let us know your availability before and during the event"
                className="min-h-[100px]"
                required
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}
