# Team Project
> Rawindhya Hettiarachchi, Matthew Gatta, Preston Van Fleet

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [How To Use](#how-to-use)
- [Challenges](#challenges)
- [Future Improvements](#future-improvements)
- [Team Members](#team-members)

## Overview
For this project, we have created a small roller coaster with a rider on the cart as well.
To complete each requirement of the project, we have implemented choosing a spline to
design the path of the track, implement slerping using Catmull-Rom, having the cart stretch
around corners, have a rider wave their arms, have multiple hierarchical models and using
gravity to speed up the cart.

## Features
- **Spline-driven track** via Catmull-Rom
- **Quaternion bank** with SLERP for smooth roll
- **Dynamic shape-deformation** (curvature + speed)
- **Skeletal rider** with waving arms
- **Hierarchical models** (cart, wheels, skeleton)
- **Physics** (gravity-based acceleration)
- **Interactive UI**: file chooser + speed slider
- **Visual polish**: gradient track, sky background, moving clouds

### Splines
We parse a text file of 3D control points and generate a Catmull-Rom spline,
sampling it to get our track vertices and tangents.

### Quaternions & SLERPing
Each control point can include a quaternion. Each frame we slerp between the two nearest quats
and build a 4×4 rotation matrix so the cart banks smoothly.

### Shape Deformation
We measure curvature and, apply a scale so the cart stretches on tight, fast turns.

### Skeletal Animation
The Skeletal Animation is completed by having a skeleton character ride the cart and have
their hands waving in the air, like someone on a roller coaster would.

### Hierarchical Modeling/Kinematics
Hierarchical Modeling is done by having a cart with wheels and a rider attached too it, where
the cart is the body and the wheels are children of the cart. In addition, the skeleton also
uses hierarchical modeling as the base is the root of the model and then the rest of the body,
such as the torso, arms and head, are based off of it.

### Physically-Based Modeling
Physics are accomplished in the project by having the cart go down with gravity. On its way down,
the cart speeds up and then slows down on its way up, like its being pulled up by a cable.

---

## How To Use
For this project, all you need to do is get the spline.txt file in the folder, run the team-project.html
file and then choose the spline-track.txt file in the choose file toggle and the animation will appear.

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
- Provided the initial starter code and README outline, refactored and cleaned up the HTML & JS for consistency, built the UI layout (canvas, file picker) and added the interactive speed slider.
- Switched the background to a lighter sky-blue, implemented a per-vertex color gradient on the track, and added moving semi-transparent clouds.
- Extended the cart’s shape deformation to include responding to speed.
- **Improved spline sampling & interpolation**:
    - Upgraded Catmull–Rom sampling from ~20 to 100 segments per span for much *smoother* curves.
    - Implemented true sub‐segment interpolation of the cart’s 2D position (rather than “snapping” to each sample) so the car moves in a continuous, fluid motion.
    - Fixed interpolation of the previous/next points to correctly measure curvature every frame.

### Matthew Gatta
I worked on wring slerp and quatToMatrix code. I worked on forces with Preston. I also added the Splines and
made it so you could input them. I added the CatmullRomCurve method too

### Preston Van Fleet
For this project, I worked on the hierarchical modeling creating the wheels on the cart and the skeleton.
With the skeleton I also implemented the skeletal animation. Other aspects I worked on was the physics of the
coaster having it speed up on the way down and slow down on the way up.
