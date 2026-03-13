
"use client";

import { PublicLayout } from '@/components/layout/public-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { BLOG_POSTS } from './posts';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const POSTS_PER_PAGE = 6;

export default function BlogListingPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Get unique categories from all posts
  const categories = useMemo(() => {
    const cats = new Set(BLOG_POSTS.map(post => post.category));
    return Array.from(cats).sort();
  }, []);

  // Filter and Sort posts (Newest First)
  const filteredAndSortedPosts = useMemo(() => {
    let posts = [...BLOG_POSTS];
    
    // Sort by date descending
    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filter by category if one is selected
    if (activeCategory) {
      posts = posts.filter(post => post.category === activeCategory);
    }

    return posts;
  }, [activeCategory]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = filteredAndSortedPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const handleCategoryChange = (cat: string | null) => {
    setActiveCategory(cat);
    setCurrentPage(1); // Reset to first page on filter change
  };

  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Blog Hero */}
        <section className="bg-primary pt-40 pb-24 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
              THE <span className="text-accent">MOVEMENT</span> BLOG
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Expert advice, packing hacks, and logistics insights from our nationwide network of 51,000 professional movers.
            </p>
          </div>
        </section>

        {/* Filters & Content */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            {/* Category Filter Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-16 pb-8 border-b">
              <div className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs">
                <Filter className="h-4 w-4 text-accent" />
                Filter by Category:
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button 
                  variant={activeCategory === null ? "default" : "outline"}
                  onClick={() => handleCategoryChange(null)}
                  className={cn(
                    "rounded-full px-6 h-9 text-xs font-bold uppercase tracking-widest transition-all",
                    activeCategory === null ? "bg-accent hover:bg-accent/90 border-accent" : "hover:border-accent hover:text-accent"
                  )}
                >
                  All Posts
                </Button>
                {categories.map((cat) => (
                  <Button 
                    key={cat}
                    variant={activeCategory === cat ? "default" : "outline"}
                    onClick={() => handleCategoryChange(cat)}
                    className={cn(
                      "rounded-full px-6 h-9 text-xs font-bold uppercase tracking-widest transition-all",
                      activeCategory === cat ? "bg-accent hover:bg-accent/90 border-accent" : "hover:border-accent hover:text-accent"
                    )}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {/* Blog Grid */}
            {paginatedPosts.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                {paginatedPosts.map((post) => {
                  const postImage = PlaceHolderImages.find(img => img.id === post.image);
                  return (
                    <Card key={post.slug} className="border-none shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col animate-fade-in">
                      <div className="h-64 relative overflow-hidden">
                        <Image 
                          src={postImage?.imageUrl || "https://picsum.photos/seed/blog/800/600"}
                          alt={post.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          data-ai-hint={postImage?.imageHint || "moving"}
                        />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-accent hover:bg-accent text-white font-black uppercase tracking-widest text-[10px]">
                            {post.category}
                          </Badge>
                        </div>
                      </div>
                      <CardHeader className="flex-1">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.date}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {post.readTime}</span>
                        </div>
                        <CardTitle className="text-2xl font-black text-primary group-hover:text-accent transition-colors leading-tight mb-4">
                          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                        </CardTitle>
                        <p className="text-muted-foreground leading-relaxed line-clamp-3 text-sm">
                          {post.excerpt}
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0 pb-8">
                        <Button asChild variant="ghost" className="p-0 h-auto text-accent font-black hover:bg-transparent hover:text-accent/80 group/btn">
                          <Link href={`/blog/${post.slug}`} className="inline-flex items-center">
                            Read Full Article <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-2 transition-transform" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 text-center space-y-4 animate-fade-in">
                <div className="bg-gray-50 p-8 rounded-3xl max-w-md mx-auto">
                  <p className="text-primary font-bold">No articles found in this category.</p>
                  <Button variant="link" onClick={() => handleCategoryChange(null)} className="text-accent">
                    View all posts instead
                  </Button>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 pt-12 border-t">
                <Button 
                  variant="outline" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="rounded-full h-12 w-12 p-0 border-gray-200"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex gap-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button 
                      key={i}
                      variant={currentPage === i + 1 ? "default" : "outline"}
                      onClick={() => setCurrentPage(i + 1)}
                      className={cn(
                        "rounded-full h-12 w-12 font-black border-gray-200",
                        currentPage === i + 1 ? "bg-primary text-white" : "text-primary hover:border-accent hover:text-accent"
                      )}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="rounded-full h-12 w-12 p-0 border-gray-200"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto bg-primary text-white p-12 rounded-3xl text-center space-y-6">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Get Moving Tips in Your Inbox</h2>
              <p className="text-white/70 max-w-xl mx-auto">
                Join our community of over 1 million happy customers and receive our monthly newsletter with exclusive moving deals and professional hacks.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button className="bg-accent hover:bg-accent/90 rounded-full px-8 font-black uppercase tracking-widest text-xs">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
