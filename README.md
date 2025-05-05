# Team Project
> Rawindhya Hettiarachchi, Matthew Gatta, Preston Van Fleet

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Demo](#demo)
- [Dependencies](#dependencies)
- [File Structure](#file-structure)
- [How To Use](#how-to-use)
- [Challenges](#challenges)
- [Future Improvements](#future-improvements)
- [Team Members](#team-members)

## Overview
...

## Features
- **Spline-driven track** via Catmull–Rom
- **Quaternion bank** with SLERP for smooth roll
- **Dynamic shape-deformation** (curvature + speed)
- **Skeletal rider** with waving arms
- **Hierarchical models** (cart, wheels, skeleton)
- **Physics** (gravity-based acceleration)
- **Interactive UI**: file chooser + speed slider
- **Visual polish**: gradient track, sky background, moving clouds

### Splines
*We parse a text file of 3D control points and generate a Catmull–Rom spline,
sampling it to get our track vertices and tangents*

### Quaternions & SLERPing
*Each control point can include a quaternion. Each frame we slerp between the two nearest quats
and build a 4×4 rotation matrix so the cart banks smoothly.*

### Shape Deformation
*We measure curvature and, apply a scale so the cart stretches on tight, fast turns.*

### Skeletal Animation
The Skeletal Animation is completed by having a skeleton characted ride the cart and have
their hands waving in the air, like someone on a roller coaster would.

### Hierarchical Modeling/Kinematics
Hierarchical Modeling is done by having a cart with wheels and a rider attached too it, where
the cart is the body and the wheels are children of the cart. In addition, the skeleton also
uses hierarchical modeleing as the base is the root of the model and then the rest of the body,
such as the torso, arms and head, are based off of it.

### Physically-Based Modeling
Physics are accomplished in the project by having the cart go down with gravity. On its way down,
the cart speeds up and then slows down on its way up, like its being pulled up by a cable.

---

## How To Use
For this project, all you need to do is get the spline.txt file in the folder, run the team-project.html
file and then choose the spline.txt file in the choose file toggle and the animation will appear.

---

## Challenges
A major challenge of the project was the shape deformation. We tried to use angles to have the cart stretch
around corners. It does slightly change shape, but not as much as we would like it too.

---

## Future Improvements
- Add textured models (cart, terrain)
- Support multiple carts / lap counting
- Add UI controls for camera angle
- Export as video or record replay

---

## Team Members
### Rawindhya Hettiarachchi
I provided the initial starter code and README outline, refactored and cleaned up the HTML + JS for 
consistency, built the UI layout (canvas, file picker) [basically making things prettier ^_^], and added the 
interactive speed slider to replace the original hard-coded base speed. I also switched the background to a 
lighter sky-blue (to emulate the sky), implemented a per-vertex color gradient on the track, added moving 
semi-transparent clouds, and extended the cart’s shape deformation to include responding to speed.

### Matthew Gatta
I worked on wring slerp and quatToMatrix code. I worked on forces with Preston. I also added the Splines and
made it so you could input them. I added the CatmullRomCurve method too

### Preston Van Fleet
For this project, I worked on the hierarchical modeling creating the wheels on the cart and the skeleton.
With the skeleton I also implemented the skeletal animation. Other aspects I worked on was the physics of the
coaster having it speed up on the way down and slow down on the way up.
