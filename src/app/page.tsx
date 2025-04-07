"use client"
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, FileText } from "lucide-react";

export default function Home() {
  const router = useRouter()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-24">
      <div className="z-10 max-w-5xl w-full flex flex-col items-center space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome to Study</h1>
          <p className="text-xl mb-8 text-muted-foreground max-w-md mx-auto">Your collaborative study platform for seamless learning</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" onClick={() => router.push("/auth/signin")}>
              Sign In
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push("/auth/signup")}>
              Sign Up
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          <Card className="h-full">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Real-time Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Work together on documents with live annotations and comments</p>
            </CardContent>
          </Card>
          
          <Card className="h-full">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Study Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Create and manage study groups with shared resources</p>
            </CardContent>
          </Card>
          
          <Card className="h-full">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Document Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Upload, organize, and share study materials easily</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
