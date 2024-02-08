interface HierarchyNode {
    id: string;
    employees?: HierarchyNode[]; 
}

export default HierarchyNode;