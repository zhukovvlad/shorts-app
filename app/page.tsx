import { Button } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { ArrowRight, Play, Sparkles, Video, Zap } from "lucide-react";
import Link from "next/link";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-6">
            <AnimatedGradientText className="inline-flex items-center px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur">
              <Sparkles className="h-4 w-4 mr-2 text-yellow-400" />
              <span className="text-sm font-medium">AI-powered video creation</span>
            </AnimatedGradientText>
          </div>
          
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-400">
            Create Viral Shorts with
            <br />
            <Cover>AI Magic</Cover>
          </h1>
          
          <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Transform any idea into engaging short videos in minutes. No editing skills required - just describe what you want and watch AI bring it to life.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button asChild className="bg-gradient-to-br from-[#3352CC] to-[#1C2D70] hover:opacity-90 text-white rounded-full font-medium text-lg px-8 py-6 h-auto">
              <Link href="/new" className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Start Creating
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="rounded-full font-medium text-lg px-8 py-6 h-auto border-white/20 text-white hover:bg-white/10">
              <Link href="#demo" className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                See Examples
              </Link>
            </Button>
          </div>
          
          <div className="text-sm text-gray-400">
            ✨ Free to start • 🚀 Create in minutes • 💰 Pay as you go
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4" id="how-it-works">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-white">
            How It Works
          </h2>
          <p className="text-xl text-gray-300 text-center mb-16 max-w-2xl mx-auto">
            From idea to viral video in 3 simple steps
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: "✍️",
                title: "Describe Your Idea",
                description: "Simply type what video you want to create. Our AI understands context and generates the perfect script."
              },
              {
                step: "2", 
                icon: "🎨",
                title: "AI Creates Content",
                description: "Watch as AI generates images, voiceover, and captions automatically based on your prompt."
              },
              {
                step: "3",
                icon: "🎬", 
                title: "Download & Share",
                description: "Get your professional-quality video ready for TikTok, YouTube Shorts, or Instagram Reels."
              }
            ].map((item, index) => (
              <div key={index} className="text-center group">
                <div className="relative mb-6">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#3352CC] to-[#1C2D70] rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">{item.title}</h3>
                <p className="text-gray-300 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white/5 backdrop-blur">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16 text-white">
            Powered by Advanced AI
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Sparkles className="h-6 w-6" />,
                title: "Smart Script Generation",
                description: "AI creates engaging narratives tailored to your topic and target audience"
              },
              {
                icon: <Video className="h-6 w-6" />,
                title: "Dynamic Visuals",
                description: "High-quality images generated and synchronized with your content"
              },
              {
                icon: <Zap className="h-6 w-6" />,
                title: "Natural Voice",
                description: "Professional voiceovers that sound human and engaging"
              }
            ].map((feature, index) => (
              <div key={index} className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur hover:bg-white/10 transition-colors duration-300">
                <div className="text-[#3352CC] mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white">
            Ready to Create Your First Viral Video?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of creators who are already using AI to grow their audience
          </p>
          
          <Button asChild className="bg-gradient-to-br from-[#3352CC] to-[#1C2D70] hover:opacity-90 text-white rounded-full font-medium text-lg px-8 py-6 h-auto">
            <Link href="/new" className="flex items-center gap-2">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          
          <p className="text-sm text-gray-400 mt-4">
            No credit card required • Start with free credits
          </p>
        </div>
      </section>
    </main>
  );
}
