'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react"; // You'll need to install lucide-react for icons

export default function Navigation() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser({
          name: session.data.user.name,
          email: session.data.user.email
        });
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 md:px-6 lg:px-8 flex h-16 items-center justify-between w-full">
        <div className="flex items-center gap-2 md:gap-6">
          <Link href="/user/dashboard" className="flex items-center">
            <span className="text-xl font-bold text-primary">Study</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/user/dashboard" 
              className="text-sm font-medium transition-colors hover:text-primary">
              Dashboard
            </Link>
            <Link href="/user/groups" 
              className="text-sm font-medium transition-colors hover:text-primary">
              Groups
            </Link>
            <Link href="/user/profile" 
              className="text-sm font-medium transition-colors hover:text-primary">
              Profile
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex text-sm font-medium">
            Hello, {displayName}
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.name ? `/api/avatar?name=${user.name}` : undefined} alt={displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/user/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/user/dashboard">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/user/groups">Groups</Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <div className="flex flex-col gap-4 py-4">
                <div className="px-4 py-2">
                  <p className="text-sm font-medium">Hello, {displayName}</p>
                </div>
                <nav className="flex flex-col gap-2">
                  <Link 
                    href="/user/dashboard" 
                    className="px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/user/groups" 
                    className="px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Groups
                  </Link>
                  <Link 
                    href="/user/profile" 
                    className="px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Button
                    variant="destructive"
                    className="mx-4 mt-2"
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                  >
                    Log Out
                  </Button>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
} 