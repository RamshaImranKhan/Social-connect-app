import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import { Button, FlatList, Image, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from './UserContext';
import { supabase } from './firebaseConfig';
import Storage from '../utils/storage';
import NotificationService from '../utils/notificationService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

function timeAgo(date) {
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${diffInDays}d ago`;
};

// Format timestamp for posts
const formatTimestamp = (date) => {
  const now = new Date();
  const postDate = new Date(date);
  const diffInMs = now - postDate;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInHours < 24) return `${diffInHours}h`;
  if (diffInDays < 7) return `${diffInDays}d`;
  
  // For older posts, show actual date
  return postDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: postDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

function getAvatar(email) {
  const letter = email?.[0]?.toUpperCase() || '?';
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#2575fc', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}>{letter}</Text>
    </View>
  );
}

export default function PostFeedScreen() {
  const { user, darkMode } = useUser();
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState({});
  const [likeCounts, setLikeCounts] = useState({}); // { postId: number }
  const [postLikes, setPostLikes] = useState({}); // { postId: [{ user_email, name, profile_picture }] }
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [currentLikesPostId, setCurrentLikesPostId] = useState(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(null);
  const [comments, setComments] = useState({}); // { postId: [comment, ...] }
  const [newComment, setNewComment] = useState('');
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [userName, setUserName] = useState('');
  const uniqueUsers = Array.from(new Set(posts.map(p => p.author)));
  const filteredUsers = search
    ? uniqueUsers.filter(u => u.toLowerCase().includes(search.toLowerCase()))
    : [];
  const searchInputRef = useRef();
  const router = useRouter();

  // Load user profile data from localStorage and Supabase
  const loadUserData = async () => {
    if (!user?.email) return;
    
    try {
      console.log('🔄 Loading profile data for user:', user.email);
      
      // Create user-specific keys to avoid cross-user data contamination
      const userSpecificNameKey = `userName_${user.email}`;
      const userSpecificPictureKey = `profilePicture_${user.email}`;
      
      // Clear any generic keys that might have old data
      await Storage.removeItem('userName');
      await Storage.removeItem('profilePicture');
      
      // Try to load user-specific data from Storage first
      const savedName = await Storage.getItem(userSpecificNameKey);
      const savedProfilePicture = await Storage.getItem(userSpecificPictureKey);
      
      console.log('💾 Loaded from storage - Name:', savedName, 'Picture:', savedProfilePicture ? 'Yes' : 'No');
      
      if (savedName) setUserName(savedName);
      if (savedProfilePicture) setProfilePicture(savedProfilePicture);
      
      // Then try to load from Supabase to get latest data
      console.log('🔍 Fetching from Supabase for:', user.email);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('name, profile_picture')
        .eq('email', user.email)
        .single();
        
      if (error) {
        console.log('⚠️ Supabase profile fetch error:', error.message);
      }
        
      if (profileData) {
        console.log('✅ Found Supabase profile data:', profileData);
        if (profileData.name) {
          setUserName(profileData.name);
          await Storage.setItem(userSpecificNameKey, profileData.name);
        }
        if (profileData.profile_picture) {
          setProfilePicture(profileData.profile_picture);
          await Storage.setItem(userSpecificPictureKey, profileData.profile_picture);
        }
      } else {
        console.log('❌ No profile data found in Supabase for:', user.email);
        // Clear any cached profile picture if no data found
        setProfilePicture(null);
        await Storage.removeItem(userSpecificPictureKey);
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      // Fallback to email-based name if everything fails
      if (!userName && user?.email) {
        const fallbackName = user.email.split('@')[0];
        setUserName(fallbackName);
        const userSpecificNameKey = `userName_${user.email}`;
        await Storage.setItem(userSpecificNameKey, fallbackName);
      }
      // Clear profile picture on error to avoid showing wrong user's picture
      setProfilePicture(null);
    }
  };

  // Fetch user profile data and posts on component mount
  useEffect(() => {
    // Clear profile state immediately when user changes to prevent showing wrong user's data
    if (user?.email) {
      console.log('👤 User changed to:', user.email);
      setProfilePicture(null);
      setUserName('');
      
      // Load fresh data for the new user
      loadUserData();
      fetchPosts();
      setupRealtimeSubscriptions();
    }
    
    // Cleanup subscriptions on unmount
    return () => {
      cleanupRealtimeSubscriptions();
    };
  }, [user]);

  // Fetch posts from Supabase backend
  const fetchPosts = async () => {
    try {
      console.log('Fetching posts from Supabase...');
      
      // Try to fetch from Supabase first (without foreign key relationships)
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        console.log('Posts fetched from Supabase:', data.length, 'posts');
        
        // Fetch profile data for each post author
        const formattedPosts = await Promise.all(data.map(async (post) => {
          // Try to get profile data for this author
          let authorName = post.author_email.split('@')[0];
          let authorProfilePicture = null;
          
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('name, profile_picture')
              .eq('email', post.author_email)
              .single();
              
            if (profileData) {
              authorName = profileData.name || authorName;
              authorProfilePicture = profileData.profile_picture;
            }
          } catch (profileErr) {
            console.warn('Could not fetch profile for:', post.author_email);
          }
          
          return {
            id: post.id,
            text: post.content,
            image: post.image_url,
            createdAt: new Date(post.created_at),
            author: post.author_email,
            authorName: authorName,
            authorProfilePicture: authorProfilePicture
          };
        }));
        
        setPosts(formattedPosts);
        fetchPostLikes(formattedPosts);
      } else {
        console.error('Failed to fetch posts from Supabase:', error);
        console.error('Error details:', error?.message, error?.details);
        // Try to load from localStorage as fallback
        loadPostsFromLocalStorage();
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      // Load from localStorage as fallback
      loadPostsFromLocalStorage();
    }
  };

  // Load posts from localStorage as fallback
  const loadPostsFromLocalStorage = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined' && window.localStorage) {
      const savedPosts = localStorage.getItem('userPosts');
      if (savedPosts) {
        try {
          const parsedPosts = JSON.parse(savedPosts);
          console.log('Posts loaded from localStorage:', parsedPosts.length, 'posts');
          const formattedPosts = parsedPosts.map(post => ({
            ...post,
            createdAt: new Date(post.createdAt)
          }));
          setPosts(formattedPosts);
          fetchPostLikes(formattedPosts);
        } catch (parseErr) {
          console.error('Error parsing localStorage posts:', parseErr);
        }
      }
    }
  };

  const fetchUserProfile = async () => {
    if (!user?.email) return;

    try {
      // Try to fetch from Supabase first
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!error && data) {
        setUserName(data.name || '');
        setProfilePicture(data.profile_picture || null);
      } else {
        // Fallback to localStorage
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const savedProfile = localStorage.getItem('userProfile');
          if (savedProfile) {
            try {
              const profileData = JSON.parse(savedProfile);
              setUserName(profileData.name || '');
              setProfilePicture(profileData.profile_picture || null);
            } catch (parseErr) {
              console.error('Error parsing localStorage profile:', parseErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      // Try localStorage as final fallback
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
          try {
            const profileData = JSON.parse(savedProfile);
            setUserName(profileData.name || '');
            setProfilePicture(profileData.profile_picture || null);
          } catch (parseErr) {
            console.error('Error parsing localStorage profile:', parseErr);
          }
        }
      }
    }
  };

  const navigateToProfile = () => {
    router.push('/profileScreen');
  };

  const renderProfilePicture = () => {
    if (profilePicture) {
      return (
        <TouchableOpacity onPress={navigateToProfile} style={styles.profilePictureContainer}>
          <Image 
            source={{ uri: profilePicture }} 
            style={styles.topProfilePicture}
            onError={() => {
              console.log('Failed to load profile picture in header');
              setProfilePicture(null);
            }}
          />
        </TouchableOpacity>
      );
    } else {
      // Show avatar with first letter of name or email
      const displayName = userName || user?.email || 'User';
      const letter = displayName[0]?.toUpperCase() || '?';
      return (
        <TouchableOpacity onPress={navigateToProfile} style={styles.profilePictureContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{letter}</Text>
          </View>
        </TouchableOpacity>
      );
    }
  };

  const handlePickImage = async () => {
    try {
      console.log('Opening image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true, 
        quality: 0.7,
        base64: true // Get base64 for cross-platform compatibility
      });
      
      console.log('Image picker result:', { 
        canceled: result.canceled, 
        hasAssets: !!result.assets, 
        assetsLength: result.assets?.length 
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        console.log('Selected image details:', {
          uri: selectedImage.uri,
          hasBase64: !!selectedImage.base64,
          width: selectedImage.width,
          height: selectedImage.height,
          fileSize: selectedImage.fileSize
        });
        
        if (!selectedImage.uri) {
          console.error('No URI in selected image');
          alert('Error: Could not access the selected image. Please try again.');
          return;
        }
        
        if (Platform.OS !== 'web' && !selectedImage.base64) {
          console.error('No base64 data in selected image for mobile');
          alert('Error: Could not process the selected image. Please try again.');
          return;
        }
        
        setImage(selectedImage);
        console.log('Image set successfully');
      } else {
        console.log('Image selection canceled or no image selected');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert('Error selecting image. Please try again.');
    }
  };

  // Upload image to Supabase Storage
  const uploadImageToSupabase = async (imageAsset) => {
    try {
      console.log('Starting image upload to Supabase...', { platform: Platform.OS, hasBase64: !!imageAsset.base64, uri: imageAsset.uri });
      
      const fileName = `post_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      let fileData;
      if (Platform.OS === 'web') {
        // For web, convert URI to blob
        try {
          const response = await fetch(imageAsset.uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
          fileData = await response.blob();
          console.log('Web image converted to blob:', fileData.size, 'bytes');
        } catch (fetchError) {
          console.error('Error fetching image for web upload:', fetchError);
          return null;
        }
      } else {
        // For mobile (React Native), use the URI directly
        if (!imageAsset.uri) {
          console.error('No URI available for mobile image upload');
          return null;
        }
        
        try {
          console.log('Using mobile image URI for upload:', imageAsset.uri);
          
          // For React Native, we can use the file URI directly
          // Create a file object that Supabase can handle
          const response = await fetch(imageAsset.uri);
          if (!response.ok) {
            throw new Error(`Failed to read image file: ${response.status}`);
          }
          
          // Get the file as an ArrayBuffer (React Native compatible)
          const arrayBuffer = await response.arrayBuffer();
          
          // Convert ArrayBuffer to Uint8Array for Supabase
          fileData = new Uint8Array(arrayBuffer);
          
          console.log('Mobile image converted to Uint8Array:', fileData.length, 'bytes');
        } catch (mobileError) {
          console.error('Error processing mobile image:', mobileError);
          return null;
        }
      }

      console.log('Uploading to Supabase storage with filename:', fileName);
    
    // First, try to upload to the bucket
    let { data, error } = await supabase.storage
      .from('post-images')
      .upload(fileName, fileData, {
        contentType: 'image/jpeg',
        upsert: false
      });

    // If bucket doesn't exist, try to create it
    if (error && error.message && error.message.includes('Bucket not found')) {
      console.log('Bucket not found, attempting to create post-images bucket...');
      
      try {
        const { data: bucketData, error: bucketError } = await supabase.storage
          .createBucket('post-images', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
          });
          
        if (bucketError) {
          console.error('Failed to create bucket:', bucketError);
        } else {
          console.log('Bucket created successfully, retrying upload...');
          
          // Retry the upload after creating bucket
          const retryResult = await supabase.storage
            .from('post-images')
            .upload(fileName, fileData, {
              contentType: 'image/jpeg',
              upsert: false
            });
            
          data = retryResult.data;
          error = retryResult.error;
        }
      } catch (bucketCreationError) {
        console.error('Error during bucket creation:', bucketCreationError);
      }
    }

    if (error) {
      console.error('Supabase storage upload error:', error);
      console.error('Error details:', { message: error.message, statusCode: error.statusCode });
      
      // Provide user-friendly error message
      if (error.message && error.message.includes('Bucket not found')) {
        console.error('Storage bucket missing. Please run the STORAGE_SETUP.sql commands in your Supabase dashboard.');
      }
      
      return null;
    }

    console.log('Image uploaded successfully to Supabase:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName);

    console.log('Generated public URL:', publicUrl);
    return publicUrl;
    } catch (err) {
      console.error('Unexpected error uploading image:', err);
      return null;
    }
  };

  const handlePost = async () => {
    if (!text.trim() && !image) {
      alert('Please enter some text or select an image to post');
      return;
    }

    if (!user?.email) {
      alert('Please log in to create a post');
      return;
    }

    setLoading(true);
    
    try {
      console.log('Creating new post...');
      
      let imageUrl = null;
      if (image) {
        console.log('Processing image for post...', { platform: Platform.OS, hasUri: !!image.uri, hasBase64: !!image.base64 });
        
        // Try to upload to Supabase first
        imageUrl = await uploadImageToSupabase(image);
        
        if (!imageUrl) {
          console.log('Supabase upload failed, using local fallback...');
          // Fallback to local storage for cross-platform compatibility
          if (Platform.OS === 'web') {
            imageUrl = image.uri;
            console.log('Using web URI as fallback:', imageUrl);
          } else {
            if (image.base64) {
              imageUrl = `data:image/jpeg;base64,${image.base64}`;
              console.log('Using base64 data as fallback for mobile');
            } else {
              console.error('No base64 data available for mobile fallback');
              alert('Error: Image data not available. Please try selecting the image again.');
              setLoading(false);
              return;
            }
          }
        } else {
          console.log('Image uploaded successfully to Supabase:', imageUrl);
        }
      }
      
      // Create post object
      const newPost = {
        content: text.trim(),
        image_url: imageUrl,
        author_email: user.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Post data:', newPost);

      // Try to save to Supabase first (without foreign key relationships)
      const { data, error } = await supabase
        .from('posts')
        .insert([newPost])
        .select('*');

      if (!error && data && data.length > 0) {
        console.log('Post saved to Supabase successfully:', data[0]);
        
        // Add the new post to the local state
        const savedPost = data[0];
        const formattedPost = {
          id: savedPost.id,
          text: savedPost.content,
          image: savedPost.image_url,
          createdAt: new Date(savedPost.created_at),
          author: savedPost.author_email,
          authorName: userName || savedPost.author_email.split('@')[0],
          authorProfilePicture: profilePicture
        };
        
        setPosts([formattedPost, ...posts]);
        
        // Also save to localStorage as backup
        savePostToLocalStorage(formattedPost);
        
        alert('Post created and saved to database successfully!');
      } else {
        console.error('Failed to save post to Supabase:', error);
        console.error('Error details:', error?.message, error?.details);
        
        // Fallback to localStorage only
        const localPost = {
          id: Date.now().toString(),
          text: text.trim(),
          image: imageUrl || (image ? (Platform.OS === 'web' ? image.uri : `data:image/jpeg;base64,${image.base64}`) : null),
          createdAt: new Date(),
          author: user.email,
          authorName: userName || user.email.split('@')[0],
          authorProfilePicture: profilePicture
        };
        
        setPosts([localPost, ...posts]);
        savePostToLocalStorage(localPost);
        
        alert('Post created and saved locally (will sync when server is available)');
      }
      
      // Clear the form
      setText('');
      setImage(null);
      
    } catch (err) {
      console.error('Error creating post:', err);
      
      // Fallback to localStorage only
      let fallbackImageUrl = imageUrl;
      if (!fallbackImageUrl && image) {
        if (Platform.OS === 'web') {
          fallbackImageUrl = image.uri;
        } else {
          // For mobile, ensure base64 data exists before using it
          if (image.base64) {
            fallbackImageUrl = `data:image/jpeg;base64,${image.base64}`;
          } else {
            console.warn('No base64 data available for mobile fallback, skipping image');
            fallbackImageUrl = null;
          }
        }
      }
      
      const localPost = {
        id: Date.now().toString(),
        text: text.trim(),
        image: fallbackImageUrl,
        createdAt: new Date(),
        author: user.email,
        authorName: userName || user.email.split('@')[0],
        authorProfilePicture: profilePicture
      };
      
      setPosts([localPost, ...posts]);
      savePostToLocalStorage(localPost);
      
      alert('Post created and saved locally (server unavailable)');
      
      // Clear the form
      setText('');
      setImage(null);
    } finally {
      setLoading(false);
    }
  };

  // Save post to localStorage
  const savePostToLocalStorage = (post) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const existingPosts = localStorage.getItem('userPosts');
        let postsArray = [];
        
        if (existingPosts) {
          postsArray = JSON.parse(existingPosts);
        }
        
        // Add new post to the beginning
        postsArray.unshift(post);
        
        // Keep only the latest 100 posts to avoid localStorage bloat
        if (postsArray.length > 100) {
          postsArray = postsArray.slice(0, 100);
        }
        
        localStorage.setItem('userPosts', JSON.stringify(postsArray));
        console.log('Post saved to localStorage');
      } catch (err) {
        console.error('Error saving post to localStorage:', err);
      }
    }
  };

  const handleLike = async (postId) => {
    if (!user?.email) {
      alert('Please log in to like posts');
      return;
    }

    const isCurrentlyLiked = likedPosts[postId];
    
    try {
      if (isCurrentlyLiked) {
        // Unlike the post
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_email', user.email);

        if (error) {
          console.error('Error unliking post (using localStorage fallback):', error);
          // Fallback to localStorage-only like system
          handleLikeLocalStorage(postId, false);
          return;
        }

        // Update local state
        setLikedPosts(prev => ({ ...prev, [postId]: false }));
        setLikeCounts(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 0) - 1) }));
        
        // Remove user from postLikes
        setPostLikes(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(like => like.user_email !== user.email)
        }));
        
      } else {
        // Like the post
        const { error } = await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_email: user.email
          }]);

        if (error) {
          console.error('Error liking post (using localStorage fallback):', error);
          // Fallback to localStorage-only like system
          handleLikeLocalStorage(postId, true);
          return;
        }

        // Update local state
        setLikedPosts(prev => ({ ...prev, [postId]: true }));
        setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
        
        // Add user to postLikes
        const userLike = {
          user_email: user.email,
          name: userName || user.email.split('@')[0],
          profile_picture: profilePicture
        };
        
        setPostLikes(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), userLike]
        }));
        
        // Send notification to post author (DISABLED - prevents console errors)
        // To enable: run supabase-push-tokens-setup.sql first
        /*
        try {
          const post = posts.find(p => p.id === postId);
          if (post && post.author !== user.email) {
            const likerName = userName || user.email.split('@')[0] || 'Someone';
            if (NotificationService) {
              await NotificationService.sendLikeNotification(
                post.author_email,
                currentUserEmail,
                post.id
              );
            }
          }
        } catch (notificationError) {
          console.log('Failed to send like notification:', notificationError);
          // Don't block the like action if notification fails
        }
        */
      }
    } catch (err) {
      console.error('Error handling like (using localStorage fallback):', err);
      // Fallback to localStorage-only like system
      handleLikeLocalStorage(postId, !isCurrentlyLiked);
    }
  };

  // Fallback like system using localStorage
  const handleLikeLocalStorage = (postId, isLiking) => {
    try {
      // Update local state
      setLikedPosts(prev => ({ ...prev, [postId]: isLiking }));
      setLikeCounts(prev => ({ 
        ...prev, 
        [postId]: isLiking ? (prev[postId] || 0) + 1 : Math.max(0, (prev[postId] || 0) - 1)
      }));
      
      if (isLiking) {
        // Add user to postLikes
        const userLike = {
          user_email: user.email,
          name: userName || user.email.split('@')[0],
          profile_picture: profilePicture
        };
        
        setPostLikes(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), userLike]
        }));
      } else {
        // Remove user from postLikes
        setPostLikes(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(like => like.user_email !== user.email)
        }));
      }
      
      // Save to localStorage
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const likesData = {
          likedPosts: { ...likedPosts, [postId]: isLiking },
          likeCounts: { 
            ...likeCounts, 
            [postId]: isLiking ? (likeCounts[postId] || 0) + 1 : Math.max(0, (likeCounts[postId] || 0) - 1)
          }
        };
        localStorage.setItem('postLikes', JSON.stringify(likesData));
      }
      
      console.log(`Post ${isLiking ? 'liked' : 'unliked'} successfully (localStorage mode)`);
    } catch (err) {
      console.error('Error in localStorage fallback:', err);
      alert('Failed to update like status');
    }
  };

  // Show who liked a post
  const showLikes = (postId) => {
    setCurrentLikesPostId(postId);
    setLikesModalVisible(true);
  };

  const closeLikes = () => {
    setLikesModalVisible(false);
    setCurrentLikesPostId(null);
  };

  // Fetch likes for posts from Supabase
  // Real-time subscription references
  const subscriptionsRef = useRef([]);

  // Setup real-time subscriptions for likes and comments
  const setupRealtimeSubscriptions = () => {
    console.log('Setting up real-time subscriptions...');
    
    // Subscribe to post_likes changes
    const likesSubscription = supabase
      .channel('post_likes_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'post_likes' },
        (payload) => {
          console.log('Real-time like change:', payload);
          handleRealtimeLikeChange(payload);
        }
      )
      .subscribe();
    
    // Subscribe to post_comments changes
    const commentsSubscription = supabase
      .channel('post_comments_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        (payload) => {
          console.log('Real-time comment change:', payload);
          handleRealtimeCommentChange(payload);
        }
      )
      .subscribe();
    
    // Subscribe to posts changes
    const postsSubscription = supabase
      .channel('posts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          console.log('Real-time post change:', payload);
          if (payload.eventType === 'INSERT') {
            fetchPosts(); // Refresh posts when new post is added
          }
        }
      )
      .subscribe();
    
    subscriptionsRef.current = [likesSubscription, commentsSubscription, postsSubscription];
  };

  // Cleanup real-time subscriptions
  const cleanupRealtimeSubscriptions = () => {
    console.log('Cleaning up real-time subscriptions...');
    subscriptionsRef.current.forEach(subscription => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    });
    subscriptionsRef.current = [];
  };

  // Handle real-time like changes
  const handleRealtimeLikeChange = async (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT' && newRecord) {
      // Someone liked a post
      const postId = newRecord.post_id;
      
      // Skip real-time updates for current user's own actions to prevent double counting
      if (newRecord.user_email === user?.email) {
        console.log('Skipping real-time update for own like action');
        return;
      }
      
      // Fetch user profile for the like
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, profile_picture')
        .eq('email', newRecord.user_email)
        .single();
      
      const userLike = {
        user_email: newRecord.user_email,
        name: profile?.name || newRecord.user_email.split('@')[0],
        profile_picture: profile?.profile_picture
      };
      
      // Update local state
      setPostLikes(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), userLike]
      }));
      
      setLikeCounts(prev => ({
        ...prev,
        [postId]: (prev[postId] || 0) + 1
      }));
      
      // Update liked status if it's the current user
      if (newRecord.user_email === user?.email) {
        setLikedPosts(prev => ({ ...prev, [postId]: true }));
      }
      
    } else if (eventType === 'DELETE' && oldRecord) {
      // Someone unliked a post
      const postId = oldRecord.post_id;
      
      // Skip real-time updates for current user's own actions to prevent double counting
      if (oldRecord.user_email === user?.email) {
        console.log('Skipping real-time update for own unlike action');
        return;
      }
      
      // Update local state
      setPostLikes(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(like => like.user_email !== oldRecord.user_email)
      }));
      
      setLikeCounts(prev => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 0) - 1)
      }));
      
      // Update liked status if it's the current user
      if (oldRecord.user_email === user?.email) {
        setLikedPosts(prev => ({ ...prev, [postId]: false }));
      }
    }
  };

  // Handle real-time comment changes
  const handleRealtimeCommentChange = async (payload) => {
    const { eventType, new: newRecord } = payload;
    
    if (eventType === 'INSERT' && newRecord) {
      // Someone added a comment
      const postId = newRecord.post_id;
      
      // Skip real-time updates for current user's own actions to prevent duplicate comments
      if (newRecord.user_email === user?.email) {
        console.log('Skipping real-time update for own comment action');
        return;
      }
      
      // Fetch user profile for the comment
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, profile_picture')
        .eq('email', newRecord.user_email)
        .single();
      
      const newComment = {
        text: newRecord.content,
        createdAt: new Date(newRecord.created_at),
        author: newRecord.user_email,
        authorName: profile?.name || newRecord.user_email.split('@')[0],
        authorProfilePicture: profile?.profile_picture
      };
      
      // Update local state
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
    }
  };

  const fetchPostLikes = async (postsData) => {
    try {
      const postIds = postsData.map(post => post.id);
      
      // Fetch like counts and user likes for all posts
      const { data: likesData, error } = await supabase
        .from('post_likes')
        .select(`
          post_id,
          user_email,
          profiles!post_likes_user_email_fkey (
            name,
            profile_picture
          )
        `)
        .in('post_id', postIds);

      if (!error && likesData) {
        // Group likes by post_id
        const likesByPost = {};
        const countsByPost = {};
        const userLikedPosts = {};
        
        likesData.forEach(like => {
          if (!likesByPost[like.post_id]) {
            likesByPost[like.post_id] = [];
            countsByPost[like.post_id] = 0;
          }
          
          likesByPost[like.post_id].push({
            user_email: like.user_email,
            name: like.profiles?.name || like.user_email.split('@')[0],
            profile_picture: like.profiles?.profile_picture
          });
          
          countsByPost[like.post_id]++;
          
          // Check if current user liked this post
          if (like.user_email === user?.email) {
            userLikedPosts[like.post_id] = true;
          }
        });
        
        setPostLikes(likesByPost);
        setLikeCounts(countsByPost);
        setLikedPosts(userLikedPosts);
        
        console.log('Likes fetched successfully from Supabase:', countsByPost);
      } else {
        console.warn('Failed to fetch likes from Supabase (table may not exist):', error);
        // Try to load from localStorage as fallback
        loadLikesFromLocalStorage();
      }
    } catch (err) {
      console.error('Error fetching likes from Supabase (using localStorage):', err);
      // Try to load from localStorage as fallback
      loadLikesFromLocalStorage();
    }
  };

  // Load likes from localStorage as fallback
  const loadLikesFromLocalStorage = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const savedLikes = localStorage.getItem('postLikes');
        if (savedLikes) {
          const likesData = JSON.parse(savedLikes);
          setLikedPosts(likesData.likedPosts || {});
          setLikeCounts(likesData.likeCounts || {});
          console.log('Likes loaded from localStorage:', likesData);
        } else {
          // Initialize empty states
          setPostLikes({});
          setLikeCounts({});
          setLikedPosts({});
        }
      } catch (err) {
        console.error('Error loading likes from localStorage:', err);
        // Initialize empty states
        setPostLikes({});
        setLikeCounts({});
        setLikedPosts({});
      }
    }
  };

  // Fetch comments for a specific post from Supabase
  const fetchCommentsForPost = async (postId) => {
    try {
      // Fetch comments from Supabase with author information
      const { data, error } = await supabase
        .from('comments_with_authors')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formattedComments = data.map(comment => ({
          id: comment.id,
          text: comment.content,
          createdAt: new Date(comment.created_at),
          author: comment.user_email,
          authorName: comment.author_name || comment.user_email?.split('@')[0] || 'Anonymous',
          authorProfilePicture: comment.author_profile_picture
        }));
        
        setComments(prev => ({
          ...prev,
          [postId]: formattedComments
        }));
      } else {
        // Try to load from localStorage as fallback
        loadCommentsFromLocalStorage(postId);
      }
    } catch (err) {
      // Load from localStorage as fallback
      loadCommentsFromLocalStorage(postId);
    }
  };

  // Load comments from localStorage as fallback
  const loadCommentsFromLocalStorage = (postId) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const savedComments = localStorage.getItem('postComments');
        if (savedComments) {
          const commentsData = JSON.parse(savedComments);
          if (commentsData[postId]) {
            // Ensure all comments have proper author names
            const formattedComments = commentsData[postId].map(comment => ({
              ...comment,
              authorName: comment.authorName || comment.author?.split('@')[0] || 'Anonymous'
            }));
            setComments(prev => ({
              ...prev,
              [postId]: formattedComments
            }));
          }
        }
      } catch (parseErr) {
        // Silent fallback - no error logging
      }
    }
  };

  // Comment modal functions
  const openComments = async (postId) => {
    setCurrentPostId(postId);
    setCommentModalVisible(true);
    // Load comments from database when opening modal
    await fetchCommentsForPost(postId);
  };

  const closeComments = () => {
    setCommentModalVisible(false);
    setNewComment('');
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    if (!user?.email) {
      return;
    }

    try {
      // Save comment to Supabase database first (primary storage)
      const commentData = {
        post_id: currentPostId,
        user_email: user.email,
        content: newComment.trim(),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('post_comments')
        .insert([commentData]);

      if (error) {
        // Fallback to local storage without showing error
        const localComment = { 
          id: Date.now().toString(),
          text: newComment.trim(), 
          createdAt: new Date(),
          author: user.email,
          authorName: userName || user.email.split('@')[0] || 'Anonymous'
        };
        setComments((prev) => ({
          ...prev,
          [currentPostId]: [
            ...(prev[currentPostId] || []),
            localComment,
          ],
        }));
      } else {
        // Refresh comments from database
        await fetchCommentsForPost(currentPostId);
        
        // Send notification to post author
        try {
          const post = posts.find(p => p.id === currentPostId);
          if (post && post.author !== user.email) {
            const commenterName = userName || user.email.split('@')[0] || 'Someone';
            await NotificationService.sendCommentNotification(
              post.author,
              commenterName,
              newComment.trim(),
              currentPostId
            );
          }
        } catch (notificationError) {
          console.log('Failed to send comment notification:', notificationError);
          // Don't block the comment action if notification fails
        }
      }
      
      setNewComment('');
      
    } catch (err) {
      // Fallback to local storage without showing error
      const localComment = { 
        id: Date.now().toString(),
        text: newComment.trim(), 
        createdAt: new Date(),
        author: user.email,
        authorName: userName || user.email.split('@')[0] || 'Anonymous'
      };
      setComments((prev) => ({
        ...prev,
        [currentPostId]: [
          ...(prev[currentPostId] || []),
          localComment,
        ],
      }));
      setNewComment('');
    }
  };

  const handleDeleteComment = async (commentId, commentIndex) => {
    try {
      // Try to delete from database first
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        // If database delete fails, remove from local state only
        setComments((prev) => ({
          ...prev,
          [currentPostId]: (prev[currentPostId] || []).filter((_, index) => index !== commentIndex)
        }));
      } else {
        // Refresh comments from database
        await fetchCommentsForPost(currentPostId);
      }
    } catch (err) {
      // Remove from local state only
      setComments((prev) => ({
        ...prev,
        [currentPostId]: (prev[currentPostId] || []).filter((_, index) => index !== commentIndex)
      }));
    }
  };

  // Delete post functionality
  const handleDeletePost = async (postId) => {
    try {
      console.log('Deleting post:', postId);
      
      // Delete from Supabase
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) {
        console.error('Error deleting post from Supabase:', error);
        // Continue with localStorage deletion as fallback
      } else {
        console.log('Post deleted from Supabase successfully');
      }

      // Update local state
      const updatedPosts = posts.filter(post => post.id !== postId);
      setPosts(updatedPosts);

      // Clean up related data
      const updatedLikedPosts = { ...likedPosts };
      delete updatedLikedPosts[postId];
      setLikedPosts(updatedLikedPosts);

      const updatedLikeCounts = { ...likeCounts };
      delete updatedLikeCounts[postId];
      setLikeCounts(updatedLikeCounts);

      const updatedPostLikes = { ...postLikes };
      delete updatedPostLikes[postId];
      setPostLikes(updatedPostLikes);

      const updatedComments = { ...comments };
      delete updatedComments[postId];
      setComments(updatedComments);

      // Update localStorage
      if (Platform.OS === 'web') {
        localStorage.setItem('posts', JSON.stringify(updatedPosts));
        localStorage.setItem('likedPosts', JSON.stringify(updatedLikedPosts));
        localStorage.setItem('likeCounts', JSON.stringify(updatedLikeCounts));
        localStorage.setItem('postLikes', JSON.stringify(updatedPostLikes));
        localStorage.setItem('comments', JSON.stringify(updatedComments));
      }

      console.log('Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={darkMode ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* Beautiful Gradient Background */}
      <LinearGradient
        colors={darkMode 
          ? ['#1a1a2e', '#16213e', '#0f3460'] 
          : ['#667eea', '#764ba2', '#f093fb']
        }
        style={styles.gradientBackground}
      >
        {/* Header with Profile */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>InternConnect</Text>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => router.push('/profileScreen')}
            >
              {renderProfilePicture()}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar with Glass Effect */}
        <View style={styles.searchContainer}>
          <TextInput
            ref={searchInputRef}
            placeholder="🔍 Search users..."
            value={search}
            onChangeText={text => { setSearch(text); setShowResults(!!text); }}
            style={styles.modernSearchInput}
            placeholderTextColor={darkMode ? '#aaa' : '#666'}
            onSubmitEditing={() => {
              if (uniqueUsers.includes(search.trim())) {
                router.push(`/profileScreen?email=${search.trim()}`);
                setShowResults(false);
                setSearch('');
              }
            }}
          />
        </View>
        {showResults && filteredUsers.length > 0 && (
          <View style={{ 
            backgroundColor: darkMode ? 'rgba(58, 58, 58, 0.9)' : '#f9f9f9', 
            borderRadius: 8, 
            marginBottom: 10, 
            maxHeight: 120, 
            maxWidth: 400, 
            alignSelf: 'center' 
          }}>
            {filteredUsers.map(email => (
              <TouchableOpacity key={email} onPress={() => {
                router.push(`/profileScreen?email=${email}`);
                setShowResults(false); setSearch('');
              }}>
                <Text style={{ 
                  padding: 8, 
                  color: '#2575fc', 
                  borderBottomWidth: 1, 
                  borderBottomColor: darkMode ? '#404040' : '#eee' 
                }}>{email}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {/* Post Composer Card */}
        <View style={styles.card}>
          <Text style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#333',
            marginBottom: 20,
            textAlign: 'center'
          }}>✨ Share Your Thoughts</Text>
          
          <TextInput
            placeholder="What's inspiring you today? 💭"
            value={text}
            onChangeText={setText}
            style={[
              styles.input,
              {
                minHeight: 80,
                textAlignVertical: 'top',
                fontSize: 16,
                color: '#333'
              }
            ]}
            placeholderTextColor="#888"
            multiline
          />
          
          {/* Image preview */}
          {image && (
            <View style={{
              alignItems: 'center',
              marginBottom: 15,
              position: 'relative'
            }}>
              <Image 
                source={{ 
                  uri: typeof image === 'string' ? image : (image.uri || image.assets?.[0]?.uri)
                }} 
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 15,
                  resizeMode: 'cover',
                  backgroundColor: '#f0f0f0'
                }}
                onError={(error) => {
                  console.log('Image preview error:', error);
                  // Don't crash, just log the error
                }}
              />
              <TouchableOpacity
                onPress={() => setImage(null)}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: 20,
                  width: 35,
                  height: 35,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
            gap: 15
          }}>
            <TouchableOpacity
              onPress={handlePickImage}
              style={{
                flex: 1,
                backgroundColor: '#667eea',
                paddingVertical: 15,
                borderRadius: 25,
                alignItems: 'center',
                shadowColor: '#667eea',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5
              }}
            >
              <Text style={{
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 16
              }}>📷 Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handlePost}
              disabled={loading || (!text.trim() && !image)}
              style={{
                flex: 1,
                backgroundColor: loading || (!text.trim() && !image) ? '#ccc' : '#764ba2',
                paddingVertical: 15,
                borderRadius: 25,
                alignItems: 'center',
                shadowColor: '#764ba2',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5
              }}
            >
              <Text style={{
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 16
              }}>{loading ? '⏳ Posting...' : '🚀 Share'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Feed */}
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={{ 
              backgroundColor: darkMode ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
              borderRadius: 20, 
              padding: 20, 
              marginBottom: 24, 
              width: 400, 
              alignSelf: 'center', 
              shadowColor: darkMode ? 'rgba(0,0,0,0.3)' : '#000', 
              shadowOffset: { width: 0, height: 2 }, 
              shadowOpacity: 0.08, 
              shadowRadius: 6, 
              elevation: 2 
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                {/* Profile Picture */}
                <TouchableOpacity 
                  onPress={() => {
                    router.push(`/profileScreen?email=${item.author}`);
                  }}
                  style={{ marginRight: 12 }}
                >
                  {item.authorProfilePicture ? (
                    <Image 
                      source={{ uri: item.authorProfilePicture }} 
                      style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: darkMode ? '#404040' : '#f0f0f0' 
                      }} 
                    />
                  ) : (
                    <View style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 20, 
                      backgroundColor: '#2575fc', 
                      justifyContent: 'center', 
                      alignItems: 'center' 
                    }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                        {(item.authorName || item.author).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                {/* Author Info */}
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => {
                    router.push(`/profileScreen?email=${item.author}`);
                  }}>
                    <Text style={{ 
                      fontWeight: 'bold', 
                      color: darkMode ? '#fff' : '#333', 
                      fontSize: 16 
                    }}>
                      {item.authorName || item.author.split('@')[0]}
                    </Text>
                    <Text style={{ 
                      color: darkMode ? '#aaa' : '#666', 
                      fontSize: 12 
                    }}>
                      @{item.author.split('@')[0]}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* Timestamp and Delete Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ 
                    color: darkMode ? '#bbb' : '#666', 
                    fontSize: 13,
                    fontWeight: '500'
                  }}>
                    {formatTimestamp(item.createdAt)}
                  </Text>
                  
                  {/* Delete Button - Only show for posts by current user */}
                  {item.author === user?.email && (
                    <TouchableOpacity 
                      onPress={() => handleDeletePost(item.id)}
                      style={{
                        padding: 4,
                        borderRadius: 4,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                      }}
                    >
                      <Text style={{ 
                        color: '#ef4444', 
                        fontSize: 12,
                        fontWeight: '600'
                      }}>
                        🗑️
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.postText, { color: darkMode ? '#fff' : '#333' }]}>{item.text}</Text>
              {item.image && <Image source={{ uri: item.image }} style={styles.postImage} />}
              
              {/* Like Count Display */}
              {(likeCounts[item.id] > 0) && (
                <View style={{ marginTop: 8, marginBottom: 4 }}>
                  <TouchableOpacity onPress={() => showLikes(item.id)}>
                    <Text style={{ 
                      color: darkMode ? '#aaa' : '#666', 
                      fontSize: 13,
                      fontWeight: '500',
                      textDecorationLine: 'underline'
                    }}>
                      {likeCounts[item.id] || 0} {(likeCounts[item.id] || 0) === 1 ? 'like' : 'likes'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: darkMode ? '#404040' : '#f0f0f0' }}>
                <TouchableOpacity 
                  onPress={() => handleLike(item.id)} 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginRight: 24,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 16,
                    backgroundColor: likedPosts[item.id] ? 'rgba(224, 36, 94, 0.1)' : 'transparent'
                  }}
                >
                  <Text style={{ 
                    color: likedPosts[item.id] ? '#e0245e' : (darkMode ? '#aaa' : '#666'), 
                    fontWeight: '600', 
                    fontSize: 14,
                    marginRight: 4
                  }}>
                    {likedPosts[item.id] ? '❤️' : '🤍'}
                  </Text>
                  <Text style={{ 
                    color: likedPosts[item.id] ? '#e0245e' : (darkMode ? '#aaa' : '#666'), 
                    fontWeight: '600', 
                    fontSize: 14
                  }}>
                    Like
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => openComments(item.id)} 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 16
                  }}
                >
                  <Text style={{ 
                    color: darkMode ? '#aaa' : '#666', 
                    fontWeight: '600', 
                    fontSize: 14,
                    marginRight: 4
                  }}>
                    💬
                  </Text>
                  <Text style={{ 
                    color: darkMode ? '#aaa' : '#666', 
                    fontWeight: '600', 
                    fontSize: 14
                  }}>
                    Comment
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          style={{ marginTop: 10, width: '100%' }}
        />
        {/* Comment Modal (unchanged) */}
        <Modal
          visible={commentModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeComments}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{ 
              backgroundColor: darkMode ? '#2d2d2d' : '#fff', 
              borderRadius: 16, 
              padding: 20, 
              width: 320 
            }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 10, color: darkMode ? '#fff' : '#333' }}>Comments</Text>
              <FlatList
                data={comments[currentPostId] || []}
                keyExtractor={(_, idx) => idx.toString()}
                renderItem={({ item, index }) => {
                  // Ensure we always have a username to display
                  const displayName = item.authorName || 
                                    (item.author ? item.author.split('@')[0] : '') || 
                                    (user?.email ? user.email.split('@')[0] : '') || 
                                    'Anonymous';
                  
                  // Check if current user can delete this comment
                  const canDelete = item.author === user?.email || user?.email === item.user_email;
                  
                  return (
                    <View style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: darkMode ? '#404040' : '#f0f0f0' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: darkMode ? '#fff' : '#333' }}>
                            <Text style={{ fontWeight: 'bold', color: darkMode ? '#4fc3f7' : '#2575fc' }}>
                              {displayName}: 
                            </Text>
                            {item.text || item.content}
                          </Text>
                          <Text style={{ color: darkMode ? '#aaa' : '#888', fontSize: 12, marginTop: 2 }}>
                            {timeAgo(new Date(item.createdAt || item.created_at || new Date()))}
                          </Text>
                        </View>
                        {canDelete && (
                          <TouchableOpacity 
                            onPress={() => handleDeleteComment(item.id, index)}
                            style={{ 
                              padding: 4, 
                              marginLeft: 8,
                              borderRadius: 4,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)'
                            }}
                          >
                            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>×</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                }}
                style={{ maxHeight: 180 }}
              />
              <TextInput
                placeholder="Add a comment..."
                value={newComment}
                onChangeText={setNewComment}
                style={{ 
                  borderWidth: 1, 
                  borderColor: darkMode ? '#404040' : '#ddd', 
                  borderRadius: 8, 
                  padding: 8, 
                  marginTop: 10, 
                  marginBottom: 10,
                  backgroundColor: darkMode ? 'rgba(58, 58, 58, 0.9)' : '#f9f9f9',
                  color: darkMode ? '#fff' : '#333'
                }}
                placeholderTextColor={darkMode ? '#888' : '#666'}
              />
              <Button title="Add Comment" onPress={handleAddComment} />
              <Button title="Close" onPress={closeComments} color="#E57373" />
            </View>
          </View>
        </Modal>
        
        {/* Likes Modal */}
        <Modal
          visible={likesModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeLikes}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{ 
              backgroundColor: darkMode ? '#2d2d2d' : '#fff', 
              borderRadius: 16, 
              padding: 20, 
              width: 320,
              maxHeight: 400
            }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 15, color: darkMode ? '#fff' : '#333' }}>Liked by</Text>
              <FlatList
                data={postLikes[currentLikesPostId] || []}
                keyExtractor={(item) => item.user_email}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      paddingVertical: 8,
                      paddingHorizontal: 4
                    }}
                    onPress={() => {
                      closeLikes();
                      router.push(`/profileScreen?email=${item.user_email}`);
                    }}
                  >
                    {/* Profile Picture */}
                    {item.profile_picture ? (
                      <Image 
                        source={{ uri: item.profile_picture }} 
                        style={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 20, 
                          marginRight: 12,
                          backgroundColor: darkMode ? '#404040' : '#f0f0f0' 
                        }} 
                      />
                    ) : (
                      <View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: '#2575fc', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        marginRight: 12
                      }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    
                    {/* User Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ 
                        fontWeight: 'bold', 
                        color: darkMode ? '#fff' : '#333', 
                        fontSize: 16 
                      }}>
                        {item.name}
                      </Text>
                      <Text style={{ 
                        color: darkMode ? '#aaa' : '#666', 
                        fontSize: 12 
                      }}>
                        @{item.user_email.split('@')[0]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 250 }}
                showsVerticalScrollIndicator={false}
              />
              <TouchableOpacity 
                onPress={closeLikes}
                style={{
                  backgroundColor: '#E57373',
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  marginTop: 15,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradientBackground: {
    flex: 1,
    paddingTop: StatusBar.currentHeight || 44,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  profileButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modernSearchInput: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: '#fff',
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    backdropFilter: 'blur(10px)',
  },
  input: {
    borderWidth: 0,
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preview: {
    width: 120,
    height: 120,
    borderRadius: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  post: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    backdropFilter: 'blur(10px)',
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
    color: '#333',
  },
  postImage: {
    width: '100%',
    height: 250,
    borderRadius: 15,
    marginBottom: 15,
    alignSelf: 'center',
  },
  timestamp: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
    fontWeight: '500',
  },
  topRightContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  profilePictureContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  topProfilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
}); 