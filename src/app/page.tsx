"use client"
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter()
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to StudySync</h1>
          <p className="text-xl mb-8">Your collaborative study platform for seamless learning</p>
          <div className="space-x-4">
            <button type="button" onClick={() => router.push("/auth/signin")}>
              Sign In
            </button>
            <button type="button" onClick={() => router.push("/auth/signup")} >
              Sign Up
            </button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Real-time Collaboration</h3>
            <p>Work together on documents with live annotations and comments</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Study Groups</h3>
            <p>Create and manage study groups with shared resources</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Document Management</h3>
            <p>Upload, organize, and share study materials easily</p>
          </div>
        </div>
      </div>
    </main>
  );
}
