# Team Project
>Rawindhya Hettiarachchi, Matthew Gatta, Preston Van Fleet

## Task List
- [ ] A brief description of what you created
- [ ] A description of how each of the above topics are represented in your program
  - [ ] Splines, drawn using Catmull-Rom, uniform B-splines, or another algorithm of your choice (other than Chaikin)
  - [ ] Quaternions and SLERPing
  - [ ] Shape Deformation
  - [ ] Skeletal Animation
  - [ ] Hierarchical Modeling/Kinematics
  - [ ] Physically-Based Modeling
- [ ] Any additional instructions that might be needed to fully use your project (interaction controls, etc.)
- [ ] What challenges you faced in completing the project.
- [ ] What each group member was responsible for designing / developing.

---

## Overview
For this project, we have created a small roller coaster with a rider on the cart as well.
To complete each requirement of the project, we have implemented choosing a spline to 
design the path of the track, implement slerping using Catmull-Rom, having the cart stretch
around corners, have a rider wave their arms, have multiple hierarchical models and using 
gravity to speed up the cart.

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

## Team Members
### Rawindhya Hettiarachchi
*TODO*

### Matthew Gatta
*I worked on wring slerp and quatToMatrix code. I worked on forces with Preston. I also added the Splines and 
made it so you could input them. I added the CatmullRomCurve method too*

### Preston Van Fleet
For this project, I worked on the hierarchical modeling creating the wheels on the cart and the skeleton. 
With the skeleton I also implemented the skeletal animation. Other aspects I worked on was the physics of the 
coaster having it speed up on the way down and slow down on the way up.

